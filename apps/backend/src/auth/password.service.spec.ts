import * as bcrypt from 'bcrypt';
import { PasswordService } from './password.service';

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
