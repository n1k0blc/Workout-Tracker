import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

async function headerMap() {
  const rules = (await nextConfig.headers!()) as Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
  expect(rules).toHaveLength(1);
  expect(rules[0].source).toBe('/:path*');
  return new Map(rules[0].headers.map((h) => [h.key, h.value]));
}

describe('next.config security headers', () => {
  it('does not advertise the framework', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('sends HSTS with a long max-age', async () => {
    const value = (await headerMap()).get('Strict-Transport-Security');
    expect(value).toBeDefined();
    const maxAge = Number(/max-age=(\d+)/.exec(value!)?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });

  it('sends nosniff', async () => {
    expect((await headerMap()).get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('denies framing', async () => {
    expect((await headerMap()).get('X-Frame-Options')).toBe('DENY');
  });

  it('introduces no Content-Security-Policy', async () => {
    const keys = [...(await headerMap()).keys()].map((k) => k.toLowerCase());
    expect(keys).not.toContain('content-security-policy');
    expect(keys).not.toContain('content-security-policy-report-only');
  });
});
