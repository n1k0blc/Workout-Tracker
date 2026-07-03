import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

// OWASP floor for argon2id (2024 cheat sheet), benchmarked as acceptable on the Pi 5.
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // 19 MiB, in KiB
  timeCost: 2,
  parallelism: 1,
};

const BCRYPT_PREFIX = /^\$2[aby]?\$/;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    if (BCRYPT_PREFIX.test(hash)) {
      return bcrypt.compare(password, hash);
    }
    return argon2.verify(hash, password);
  }

  needsRehash(hash: string): boolean {
    return BCRYPT_PREFIX.test(hash);
  }
}
