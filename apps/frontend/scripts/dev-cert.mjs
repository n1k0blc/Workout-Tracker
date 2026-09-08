/**
 * A dev HTTPS certificate that a phone will actually accept (#149).
 *
 * `next dev --experimental-https` issues a certificate for `localhost` and `127.0.0.1` only.
 * That is fine on the machine running it and useless from a phone, which reaches the dev
 * server by LAN address: the name mismatch is a hard failure in iOS Safari, with no "visit
 * anyway" escape offered — so the scanner cannot be tested on a real camera at all.
 *
 * This reissues the certificate from the same mkcert CA `--experimental-https` already put in
 * the login keychain, adding this machine's current LAN address and its `.local` name. The
 * `.local` name is the one worth using: it survives a DHCP lease change, which the address
 * does not, and this script is cheap to re-run when it does.
 *
 * The CA is still not a public one, so the phone shows a warning until the CA itself is
 * trusted there once — see docs/barcode-scanner-testing.md. What this fixes is the *mismatch*
 * underneath the warning.
 *
 * Runs from `predev:https`. Regenerates whenever the address set changes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces, hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'certificates');
const certPath = join(outDir, 'dev.pem');
const keyPath = join(outDir, 'dev-key.pem');
const sansPath = join(outDir, '.dev-sans');

const CA_DIR = join(
  process.env.HOME ?? '',
  'Library',
  'Application Support',
  'mkcert',
);
const caCert = join(CA_DIR, 'rootCA.pem');
const caKey = join(CA_DIR, 'rootCA-key.pem');

/** Every non-internal IPv4 address this machine answers on. */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

if (!existsSync(caCert) || !existsSync(caKey)) {
  // Nothing to sign with. Not fatal: `next dev --experimental-https` will make its own
  // localhost-only certificate, which is all the machine itself needs.
  console.log(
    'dev-cert: no mkcert CA yet — run `pnpm run dev:https` once to create one, then re-run this.',
  );
  process.exit(0);
}

/**
 * The mDNS name the phone can actually resolve. `os.hostname()` is the router-assigned name
 * (`MacBookAir.fritz.box` here), which is not it -- macOS publishes `LocalHostName` over
 * Bonjour instead.
 */
function localName() {
  try {
    const name = execFileSync('scutil', ['--get', 'LocalHostName'], { stdio: 'pipe' })
      .toString()
      .trim();
    if (name) return `${name}.local`;
  } catch {
    // Not macOS, or scutil unavailable -- fall back to the plain hostname below.
  }
  return `${hostname()}`.replace(/\.local$/, '') + '.local';
}

const names = ['localhost', localName()];
const ips = ['127.0.0.1', '::1', ...lanAddresses()];
const san = [
  ...names.map((n) => `DNS:${n}`),
  ...ips.map((ip) => `IP:${ip}`),
].join(',');

// Skip the work when nothing about this machine's addresses has changed.
if (
  existsSync(certPath) &&
  existsSync(keyPath) &&
  existsSync(sansPath) &&
  readFileSync(sansPath, 'utf8') === san
) {
  console.log(`dev-cert: up to date (${san})`);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const confPath = join(outDir, '.openssl.cnf');
writeFileSync(
  confPath,
  `[req]\ndistinguished_name=dn\nreq_extensions=v3\nprompt=no\n[dn]\nCN=Workout Tracker dev\n[v3]\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`,
);
const csrPath = join(outDir, '.dev.csr');

try {
  execFileSync('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', csrPath, '-config', confPath], { stdio: 'pipe' });
  execFileSync('openssl', ['x509', '-req', '-in', csrPath, '-CA', caCert, '-CAkey', caKey,
    '-CAcreateserial', '-out', certPath, '-days', '825', '-sha256',
    '-extfile', confPath, '-extensions', 'v3'], { stdio: 'pipe' });
} catch (error) {
  console.error('dev-cert: openssl failed\n', error.stderr?.toString() ?? error.message);
  process.exit(1);
}

writeFileSync(sansPath, san);
rmSync(csrPath, { force: true });
rmSync(confPath, { force: true });
console.log(`dev-cert: issued ${certPath}\n  for ${san}`);
