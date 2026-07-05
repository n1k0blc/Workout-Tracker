import { generateOpaqueToken, hashToken, timingSafeEqualStrings } from './token.util';

describe('token.util', () => {
  describe('generateOpaqueToken', () => {
    it('generates high-entropy, URL-safe tokens', () => {
      const token = generateOpaqueToken();
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('never generates the same token twice', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateOpaqueToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe('hashToken', () => {
    it('is deterministic', () => {
      const token = generateOpaqueToken();
      expect(hashToken(token)).toBe(hashToken(token));
    });

    it('produces different hashes for different tokens', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });

    it('produces a 64-char hex sha256 digest', () => {
      expect(hashToken('anything')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('timingSafeEqualStrings', () => {
    it('returns true for identical strings', () => {
      expect(timingSafeEqualStrings('abc123', 'abc123')).toBe(true);
    });

    it('returns false for different strings of equal length', () => {
      expect(timingSafeEqualStrings('abc123', 'abc124')).toBe(false);
    });

    it('returns false for different-length strings without throwing', () => {
      expect(timingSafeEqualStrings('short', 'a-much-longer-string')).toBe(false);
    });

    it('returns false when comparing against an empty string', () => {
      expect(timingSafeEqualStrings('nonempty', '')).toBe(false);
    });
  });
});
