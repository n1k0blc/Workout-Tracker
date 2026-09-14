import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto';

/**
 * Focused on the breached-password screening added for issue #121: registration
 * and password changes must reject known-breached passwords, keep working when
 * the screening service is unavailable, and still let good passwords through.
 */
function baseRegisterDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return {
    email: 'new@example.com',
    password: 'a-strong-unique-passphrase',
    firstName: 'Sam',
    lastName: 'Lee',
    dateOfBirth: '1990-01-01',
    height: 180,
    weight: 80,
    homeGyms: [{ name: 'Home' }],
    ...overrides,
  } as RegisterDto;
}

function makeService({ breached }: { breached: boolean }) {
  const createdUser = { id: 'user-1', email: 'new@example.com', locale: 'DE' };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(createdUser),
      findUniqueOrThrow: jest.fn().mockResolvedValue(createdUser),
      update: jest.fn().mockResolvedValue(createdUser),
    },
  };
  const jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const passwordService = {
    hash: jest.fn().mockResolvedValue('argon2-hash'),
    verify: jest.fn().mockResolvedValue(true),
    needsRehash: jest.fn().mockReturnValue(false),
  };
  const breachedPasswordService = { isBreached: jest.fn().mockResolvedValue(breached) };
  const refreshTokenService = {
    issue: jest.fn().mockResolvedValue({ rawToken: 'refresh', expiresAt: new Date() }),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AuthService(
    prisma as any,
    jwtService as any,
    passwordService as any,
    breachedPasswordService as any,
    refreshTokenService as any,
  );

  return { service, prisma, passwordService, breachedPasswordService, refreshTokenService };
}

describe('AuthService breached-password screening', () => {
  describe('register', () => {
    it('rejects a breached password without creating the user', async () => {
      const { service, prisma, passwordService } = makeService({ breached: true });

      const result = service.register(baseRegisterDto({ password: 'password' }));
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toMatchObject({ code: 'PASSWORD_BREACHED' });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('creates the user when the password is not breached', async () => {
      const { service, prisma } = makeService({ breached: false });

      const session = await service.register(baseRegisterDto());

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(session.accessToken).toBe('access-token');
    });

    it('lets registration through when the screening service is unavailable (fail open)', async () => {
      const { service, prisma, breachedPasswordService } = makeService({ breached: false });
      // BreachedPasswordService resolves false on outage rather than throwing.
      breachedPasswordService.isBreached.mockResolvedValue(false);

      await service.register(baseRegisterDto());

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'old-good-password', newPassword: 'password' };

    it('rejects a breached new password and keeps the old hash', async () => {
      const { service, prisma, refreshTokenService } = makeService({ breached: true });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'argon2-old' });

      await expect(service.changePassword('user-1', dto as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(refreshTokenService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('updates the password when the new one is not breached', async () => {
      const { service, prisma, refreshTokenService } = makeService({ breached: false });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'argon2-old' });

      await service.changePassword('user-1', {
        currentPassword: 'old-good-password',
        newPassword: 'another-strong-unique-passphrase',
      } as any);

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});

/**
 * Locale tracer bullet (#179): registration derives `locale` from the `X-Locale` header
 * the frontend sends (the `[locale]` URL segment active at submit time) and seeds
 * `unitSystem` once from the browser's `Accept-Language` -- two independent signals,
 * neither a new form field. Both `register()` and `login()` map the Prisma row's
 * uppercase `locale` enum back to the lowercase wire type before returning.
 */
describe('AuthService locale and unitSystem (#179)', () => {
  describe('register', () => {
    it('persists the locale carried on X-Locale and maps it back on the returned user', async () => {
      const { service, prisma } = makeService({ breached: false });
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com', locale: 'EN' });

      const session = await service.register(baseRegisterDto(), { localeHeader: 'en' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ locale: 'EN' }) }),
      );
      expect(session.user.locale).toBe('en');
    });

    it('falls back to de when no X-Locale header is sent', async () => {
      const { service, prisma } = makeService({ breached: false });

      await service.register(baseRegisterDto());

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ locale: 'DE' }) }),
      );
    });

    it('seeds unitSystem imperial only for an en-US Accept-Language', async () => {
      const { service, prisma } = makeService({ breached: false });

      await service.register(baseRegisterDto(), { acceptLanguageHeader: 'en-US,en;q=0.9' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ unitSystem: 'IMPERIAL' }) }),
      );
    });

    it('seeds unitSystem metric for a German or missing Accept-Language', async () => {
      const { service, prisma } = makeService({ breached: false });

      await service.register(baseRegisterDto(), { acceptLanguageHeader: 'de-DE,de;q=0.9' });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ unitSystem: 'METRIC' }) }),
      );

      await service.register(baseRegisterDto());
      expect(prisma.user.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ unitSystem: 'METRIC' }) }),
      );
    });
  });

  describe('login', () => {
    it('maps a stored uppercase locale to the lowercase wire type', async () => {
      const { service, prisma } = makeService({ breached: false });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        passwordHash: 'argon2-hash',
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        locale: 'DE',
      });

      const session = await service.login({
        email: 'new@example.com',
        password: 'a-strong-unique-passphrase',
      });

      expect(session.user.locale).toBe('de');
    });
  });
});
