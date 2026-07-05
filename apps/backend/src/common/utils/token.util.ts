import { randomBytes, createHash, timingSafeEqual } from 'crypto';

// Opaque, high-entropy refresh token. Only its hash is ever persisted.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Constant-time string comparison (equal-length inputs assumed to be hex/base64url tokens).
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
