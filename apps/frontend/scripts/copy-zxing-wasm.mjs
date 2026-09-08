/**
 * Puts the zxing reader wasm where the app can serve it (#149).
 *
 * The barcode scanner falls back to zxing on browsers without a native `BarcodeDetector`
 * (Safari, Firefox). The polyfill would fetch the wasm from a CDN, which the app's
 * `connect-src 'self'` CSP blocks -- and the Pi is often reached over a private tunnel with no
 * route to jsDelivr anyway. So the binary is served from `public/` instead.
 *
 * It is copied rather than committed: a stale 1 MB binary that silently disagrees with the
 * installed `zxing-wasm` glue is a bad failure mode. `zxing-wasm` is resolved *through*
 * `barcode-detector` rather than as a direct dependency for the same reason -- the polyfill
 * pins the version whose glue code has to match this file.
 *
 * Runs from `predev` and `prebuild`.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, 'noop.js'));

// The version of zxing-wasm that `barcode-detector` itself loads, wherever pnpm put it.
const readerEntry = createRequire(require.resolve('barcode-detector')).resolve('zxing-wasm/reader');
const packageRoot = readerEntry.split(`${sep}dist${sep}`)[0];
const source = join(packageRoot, 'dist', 'reader', 'zxing_reader.wasm');
const target = join(here, '..', 'public', 'zxing_reader.wasm');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`zxing wasm: ${source} -> ${target}`);
