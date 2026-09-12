/**
 * One barcode decoder, whichever engine the browser has (#149).
 *
 * Chrome on Android ships `BarcodeDetector` natively. Safari (iOS included) and Firefox do
 * not, so those fall back to the zxing WebAssembly build behind the `barcode-detector`
 * polyfill -- the same API, ~1 MB of wasm, loaded only when it is actually needed.
 *
 * The wasm is served from `public/`, not a CDN: the app's CSP is `connect-src 'self'` and the
 * Pi is reachable over a private tunnel, so a jsDelivr fetch would fail exactly where the
 * fallback matters most. `scripts/copy-zxing-wasm.mjs` keeps the copy in step with the
 * installed `zxing-wasm`.
 */

/** The symbologies on food packaging. Narrowing this also makes the decode measurably faster. */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const;

export interface BarcodeReader {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

type NativeDetector = new (options: { formats: string[] }) => BarcodeReader;

/** Where the wasm sits once `pnpm run copy:zxing-wasm` (a `predev`/`prebuild` step) has run. */
const WASM_PATH = '/zxing_reader.wasm';

/**
 * True when the browser decodes barcodes itself. Also checks that it actually supports the
 * formats we need: `BarcodeDetector` exists on some builds that read QR codes only, and
 * `getSupportedFormats` is the only way to tell.
 */
async function nativeDetector(): Promise<NativeDetector | null> {
  const ctor = (globalThis as { BarcodeDetector?: NativeDetector & { getSupportedFormats?: () => Promise<string[]> } })
    .BarcodeDetector;
  if (!ctor?.getSupportedFormats) return null;
  try {
    const supported = await ctor.getSupportedFormats();
    return BARCODE_FORMATS.every((format) => supported.includes(format)) ? ctor : null;
  } catch {
    return null;
  }
}

/**
 * A reader for this browser. Resolves the native detector when there is one, otherwise
 * dynamically imports the polyfill so the wasm never loads on Chrome.
 */
export async function createBarcodeReader(): Promise<BarcodeReader> {
  const native = await nativeDetector();
  if (native) return new native({ formats: [...BARCODE_FORMATS] });

  const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill');
  setZXingModuleOverrides({ locateFile: () => WASM_PATH });
  return new BarcodeDetector({ formats: [...BARCODE_FORMATS] });
}
