import { isLocalDevOrigin } from './dev-cors';

/**
 * The dev-only CORS allowance. Never consulted in production, which uses a strict explicit
 * allowlist -- see the `isProduction` branch in `main.ts`.
 */
describe('isLocalDevOrigin', () => {
  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.178.24:3000',
    'http://10.0.0.5:3000',
    'http://172.16.0.9:3000',
    'http://172.31.255.254:3000',
  ])('allows the plain-HTTP dev origin %s', (origin) => {
    expect(isLocalDevOrigin(origin)).toBe(true);
  });

  it.each([
    // The barcode scanner needs a camera, a camera needs a secure context, so dev now also
    // runs over HTTPS (#149). The same hosts have to be allowed on both schemes.
    'https://localhost:3000',
    'https://192.168.178.24:3000',
    // ...and by the Bonjour name a phone actually resolves.
    'https://macbook-air-von-niko.local:3000',
    'http://macbook-air-von-niko.local:3000',
  ])('allows the HTTPS / mDNS dev origin %s', (origin) => {
    expect(isLocalDevOrigin(origin)).toBe(true);
  });

  it.each([
    ['a public host', 'https://example.com'],
    ['a public host on a dev port', 'http://evil.com:3000'],
    // The old startsWith checks let these through: "http://192.168." is a prefix of both.
    ['a lookalike subdomain', 'http://192.168.attacker.com'],
    ['a lookalike prefix host', 'http://192.168.0.1.evil.com'],
    ['a .local lookalike', 'https://mymac.local.evil.com'],
    // 172.32+ is outside the private 172.16/12 block.
    ['an out-of-range 172 address', 'http://172.32.0.1:3000'],
    ['a non-http scheme', 'file://localhost'],
    ['nonsense', 'not-a-url'],
    ['an empty string', ''],
  ])('rejects %s', (_label, origin) => {
    expect(isLocalDevOrigin(origin)).toBe(false);
  });
});
