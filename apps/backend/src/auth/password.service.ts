import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

// OWASP floor for argon2id (2024 cheat sheet), benchmarked as acceptable on the Pi 5.
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // 19 MiB, in KiB
  timeCost: 2,
  parallelism: 1,
};

/**
 * An argon2id hash of a random password nobody knows, made with the options above. Login verifies
 * against it when the address is unknown, so that case costs the same as a wrong password and the
 * response time does not reveal which addresses have an account (#225). If ARGON2_OPTIONS change,
 * regenerate it: `password.service.spec.ts` fails when its parameters drift.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$9rrxmnLM1H3iJfHi/zNWSg$N21LcmH8H1yzFhAzDt+mdFgMNCIzWGwwZDbt95/7soA';

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
