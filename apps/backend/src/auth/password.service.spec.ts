import * as bcrypt from 'bcrypt';
import { DUMMY_PASSWORD_HASH, PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  describe('hash', () => {
    it('produces an argon2id hash', async () => {
      const hash = await service.hash('correct horse battery staple');
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });
  });

  describe('verify', () => {
    it('verifies a password against its own argon2id hash', async () => {
      const hash = await service.hash('correct horse battery staple');
      await expect(service.verify('correct horse battery staple', hash)).resolves.toBe(true);
    });

    it('rejects the wrong password against an argon2id hash', async () => {
      const hash = await service.hash('correct horse battery staple');
      await expect(service.verify('wrong password', hash)).resolves.toBe(false);
    });

    it('verifies a password against a legacy bcrypt hash', async () => {
      const hash = await bcrypt.hash('legacy password', 10);
      await expect(service.verify('legacy password', hash)).resolves.toBe(true);
    });

    it('rejects the wrong password against a legacy bcrypt hash', async () => {
      const hash = await bcrypt.hash('legacy password', 10);
      await expect(service.verify('wrong password', hash)).resolves.toBe(false);
    });
  });

  describe('DUMMY_PASSWORD_HASH', () => {
    // Login verifies against it for an unknown address; it only hides timing if it costs what a
    // real hash costs, so it has to carry the parameters hash() uses today.
    it('has the same algorithm and cost parameters as a fresh hash', async () => {
      const parameters = (hash: string) => hash.split('$').slice(0, 4).join('$');
      expect(parameters(DUMMY_PASSWORD_HASH)).toBe(parameters(await service.hash('anything')));
    });

    it('matches no password anyone could send', async () => {
      await expect(service.verify('anything', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('flags legacy bcrypt hashes ($2a$/$2b$/$2y$) for rehash', async () => {
      const hash = await bcrypt.hash('legacy password', 10);
      expect(service.needsRehash(hash)).toBe(true);
    });

    it('does not flag argon2id hashes for rehash', async () => {
      const hash = await service.hash('correct horse battery staple');
      expect(service.needsRehash(hash)).toBe(false);
    });
  });
});
