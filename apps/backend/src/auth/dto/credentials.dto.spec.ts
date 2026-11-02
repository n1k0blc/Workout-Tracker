import { ArgumentMetadata, BadRequestException, Type } from '@nestjs/common';
import { createValidationPipe } from '../../common/errors/validation-pipe';
import { UpdateUserDto } from '../../users/dto';
import { ChangePasswordDto } from './change-password.dto';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

/**
 * Sign-in hardening (#225, parent #221): the e-mail address and password rules on the real DTOs,
 * through the app-wide ValidationPipe.
 */

const registration = {
  password: 'correct horse',
  firstName: 'Max',
  lastName: 'Mustermann',
  dateOfBirth: '1990-01-01',
  height: 180,
  weight: 75,
  homeGyms: [{ name: 'Fit & Fun' }],
};

async function run(metatype: Type<unknown>, payload: Record<string, unknown>) {
  const meta: ArgumentMetadata = { type: 'body', metatype };
  try {
    const dto = (await createValidationPipe().transform(payload, meta)) as Record<string, unknown>;
    return { dto, errors: [] as { property: string; constraints: string[] }[] };
  } catch (e) {
    const errors = (
      (e as BadRequestException).getResponse() as {
        errors: { property: string; constraints: string[] }[];
      }
    ).errors;
    return { dto: undefined, errors };
  }
}

const constraintsOf = async (
  metatype: Type<unknown>,
  payload: Record<string, unknown>,
  field: string,
) => (await run(metatype, payload)).errors.find((e) => e.property === field)?.constraints;

const emailForms: [string, Type<unknown>, Record<string, unknown>][] = [
  ['register', RegisterDto, registration],
  ['login', LoginDto, { password: 'correct horse' }],
  ['profile update', UpdateUserDto, {}],
];

describe.each(emailForms)('e-mail address on %s', (_name, metatype, rest) => {
  const send = (email: unknown) => run(metatype, { ...rest, email });

  it('is trimmed and lowercased before anything else sees it', async () => {
    expect((await send('  Niko@Example.COM ')).dto?.email).toBe('niko@example.com');
  });

  it('answers one message for an address that is not valid, whatever its case or padding', async () => {
    expect((await send('not-an-address')).errors).toEqual([
      { property: 'email', constraints: ['isEmail'] },
    ]);
    expect((await send('  NOT-AN-ADDRESS ')).errors).toEqual([
      { property: 'email', constraints: ['isEmail'] },
    ]);
  });
});

describe('LoginDto password', () => {
  const login = (password: unknown) => ({ email: 'a@example.com', password });

  it('is 8 to 100 characters, checked before any hashing', async () => {
    expect(await constraintsOf(LoginDto, login('a'.repeat(8)), 'password')).toBeUndefined();
    expect(await constraintsOf(LoginDto, login('a'.repeat(7)), 'password')).toEqual(['minLength']);
    expect(await constraintsOf(LoginDto, login('a'.repeat(100)), 'password')).toBeUndefined();
    expect(await constraintsOf(LoginDto, login('a'.repeat(101)), 'password')).toEqual([
      'maxLength',
    ]);
  });

  it('is not trimmed: spaces are legitimate password characters', async () => {
    expect((await run(LoginDto, login('  pass  word '))).dto?.password).toBe('  pass  word ');
  });
});

describe('ChangePasswordDto', () => {
  const change = (overrides: Record<string, unknown>) => ({
    currentPassword: 'correct horse',
    newPassword: 'battery staple',
    ...overrides,
  });

  it.each(['currentPassword', 'newPassword'])(
    'keeps %s between 8 and 100 characters',
    async (field) => {
      const check = (value: string) =>
        constraintsOf(ChangePasswordDto, change({ [field]: value }), field);
      expect(await check('a'.repeat(8))).toBeUndefined();
      expect(await check('a'.repeat(7))).toEqual(['minLength']);
      expect(await check('a'.repeat(100))).toBeUndefined();
      expect(await check('a'.repeat(101))).toEqual(['maxLength']);
    },
  );
});
