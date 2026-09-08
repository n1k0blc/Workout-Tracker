# Testing the barcode scanner

The scanner (#149) is the one feature in the app that cannot be tested from a desktop browser
tab on `localhost` alone: it needs a rear camera, and a rear camera needs a **secure context**.
This is what to do about that.

## The HTTPS rule

`navigator.mediaDevices` only exists on a secure context — HTTPS, or `localhost`. On plain
HTTP the object is simply absent: there is no permission prompt, no error, and nothing for a
user to "allow". That is why the scanner detects this case by name and says *"Die Kamera
braucht HTTPS"* rather than the usual *"Zugriff in den Browser-Einstellungen erlauben"* — the
latter would send someone hunting through settings for a switch that does not exist.

`pnpm run dev:mobile` serves plain HTTP over the LAN, so **the camera will not work there**.
The manual EAN field is the intended path in that setup, and it reaches the identical lookup.

## Testing on a phone

### iPhone / Safari — `pnpm run dev:https`

This is the setup for iOS, and iOS is the one that matters most: it is the only platform that
exercises the zxing WebAssembly fallback.

```bash
pnpm --filter frontend run dev:https
```

It serves the dev server over HTTPS (Next generates a certificate via mkcert) and sets
`NEXT_PUBLIC_API_URL=/api`, so the browser makes **no cross-origin call at all** — the
dev-only rewrite in `next.config.ts` proxies `/api/*` to the backend on :3001.

That proxy is not a convenience; without it the page cannot work over HTTPS at all:

- an `https://` page calling `http://localhost:3001` is blocked as **mixed content**, and
- `main.ts`'s CORS allowlist only permits `http://` local origins, so the request would be
  **rejected by CORS** even if it were allowed to leave.

Proxying also gives dev the same first-party cookie semantics production has. The auth cookies
are `SameSite=lax`; across two dev origins they survive only because cookies ignore the port.

`predev:https` also reissues the certificate via `scripts/dev-cert.mjs`. Next's own
`--experimental-https` covers `localhost` and `127.0.0.1` only; a phone reaches the dev server
by LAN address, and that name mismatch is fatal in iOS Safari — it shows "Diese Verbindung ist
nicht privat" and offers no way through. The script re-signs from the same mkcert CA with this
machine's addresses and its Bonjour `.local` name added.

Then, on the phone (same Wi-Fi), open `https://<LocalHostName>.local:3000` — `scutil --get
LocalHostName` prints the name. Prefer it over the raw IP: it survives a DHCP lease change.

The CA is a local one, so Safari still warns the first time. Tap **Details einblenden → Diese
Website besuchen**. If the camera then works, you are done.

**If Safari refuses to offer that, or the camera still will not start**, trust the CA on the
phone once:

```bash
open -R ~/Library/Application\ Support/mkcert/rootCA.pem
```

AirDrop that file to the iPhone (send `rootCA.pem` only — never `rootCA-key.pem`), then
**Settings → Profil geladen → Installieren**, and finally **Settings → Allgemein → Info →
Zertifikatsvertrauenseinstellungen** and enable full trust for the mkcert CA. Reload; the
warning is gone and the origin is a proper secure context.

Re-run `pnpm run dev:https` after changing networks — the script notices the new address and
reissues; the CA stays trusted, so the phone needs nothing further.

### Android / Chrome over USB

Simplest of all, and needs no certificates. With the phone attached and USB debugging on:

```bash
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:3001 tcp:3001
```

Run the ordinary `pnpm run dev` and open **`http://localhost:3000`** on the phone. Chrome
treats `http://localhost` as a secure context, so the camera works, and nothing is HTTPS so
there is no mixed content to block.

### Against the Pi

The deployed app is behind the Cloudflare tunnel on `https://workout.nikobjelic.com`, a proper
secure context with a real certificate. The slowest loop, but the only one that exercises the
Open Food Facts lookup from the Pi's own network rather than from your Mac.

## What to check on each engine

Two decoders are in play, and they take different code paths (`lib/barcode-detector.ts`):

| Browser | Decoder | What to watch for |
| --- | --- | --- |
| Chrome / Android | native `BarcodeDetector` | no `zxing_reader.wasm` request in DevTools |
| Safari / iOS | zxing WebAssembly fallback | `zxing_reader.wasm` is fetched from the app's own origin, ~1 MB, once |
| Firefox | zxing WebAssembly fallback | as above |

Test codes worth keeping around, one per symbology:

- EAN-13 — `4025500287955`
- EAN-8 — `96385074`
- UPC-A — `036000291452` (comes back as `0036000291452`; a UPC-A *is* an EAN-13)

Typing these into the manual field exercises everything after the decoder, so most of the
scanner can be tested without a camera at all.

## The wasm asset

`public/zxing_reader.wasm` is **not** committed. `scripts/copy-zxing-wasm.mjs` copies it out of
the installed `zxing-wasm` on `predev` and `prebuild`, so it can never drift from the glue code
that loads it. If the fallback ever 404s on that file, a build step was skipped — run
`node scripts/copy-zxing-wasm.mjs` from `apps/frontend`.

It is served from our own origin rather than a CDN because the app's CSP is `connect-src
'self'`, and because the Pi is often reached over a tunnel with no route out to jsDelivr.
Compiling it needs `'wasm-unsafe-eval'` in `script-src`, which `middleware.ts` grants.

## Things that are easy to get wrong

- **A code that reads but does not resolve.** The decoder returns anything it sees, including
  the checksum-failing misreads you get at a steep angle. `normalizeBarcode` throws those away
  and the next frame tries again — so a code that "won't scan" is usually a framing problem,
  not a broken decoder.
- **The camera staying on.** The stream is torn down whenever the result sheet is up and when
  the scanner closes. If the phone's camera indicator stays lit after closing, that is a bug.
- **Rescanning something you deleted.** A soft-deleted food keeps its barcode (it is the
  product's global identity, and unique across deleted rows). Rescanning it brings the row
  back rather than failing on the unique index — worth checking after any change to
  `FoodsService.lookupByBarcode`.
