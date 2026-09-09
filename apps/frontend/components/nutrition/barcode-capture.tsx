'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCameraOff, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { barcodeError, normalizeBarcode } from '@/lib/barcode';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

/**
 * Getting one barcode out of a person (#149), screens 06 / 06b.
 *
 * A full-screen dark viewfinder over the rear camera, with a manual EAN field underneath for
 * desktops, for the plain-HTTP dev setup, and for a code the camera cannot read. Both routes
 * hand the caller the same canonical barcode; what happens to it is the caller's business --
 * the food editor just wants the digits, the scanner runs the whole miss chain.
 *
 * `children` is the sheet that slides up under the viewfinder once there is something to say.
 *
 * It portals to `document.body` because every caller renders it from inside a drawer or a
 * dialog: a full-screen `fixed` overlay nested in one of those would be positioned against
 * its transformed ancestor instead of the viewport, and sit under its overlay. Every layer in
 * this app is `z-50`, so what ends up on top is portal mount order -- which is open order,
 * and therefore already what you want.
 *
 * That portal is also why the root sets `pointer-events: auto` explicitly. While a modal
 * drawer or dialog is open, Radix's dismissable layer sets `pointer-events: none` on
 * `document.body` and re-enables it only inside its own content. This overlay is a sibling of
 * that content, so without the override it inherits `none` and every control in it is dead --
 * the camera still decodes, the result still renders, and not a single button responds.
 *
 * The logging flow no longer needs that override: `ScanToLog` is rendered by the page and the
 * picker is closed before it opens, so no modal layer is above it. It is still load-bearing
 * for the Lebensmittel editor's EAN scan button, which opens this from *inside* a Radix
 * dialog. That path has the other half of the same problem too -- the dialog's focus trap
 * fights the manual EAN field -- and has not been verified on a device. Treat it as suspect.
 */
export function BarcodeCapture({
  open,
  onOpenChange,
  onBarcode,
  paused = false,
  busy = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A decoded or typed code, already canonical -- checked before it gets here. */
  onBarcode: (barcode: string) => void;
  /** Stop the camera without closing: something is on screen and nothing should re-scan. */
  paused?: boolean;
  /** Disable the manual field's submit while a lookup is in flight. */
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onBarcodeRef = useRef(onBarcode);
  useEffect(() => {
    onBarcodeRef.current = onBarcode;
  }, [onBarcode]);

  useEffect(() => {
    if (open) {
      setManual('');
      setError(null);
    }
  }, [open]);

  const { videoRef, state, reason, insecureContext } = useBarcodeScanner({
    active: open && !paused,
    onDetected: (barcode) => onBarcodeRef.current(barcode),
  });

  // Escape closes the scanner and nothing else. Captured at the document, so it lands before
  // the drawer or dialog underneath sees it -- those would otherwise close too, or instead.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onOpenChange]);

  function submitManual() {
    const barcode = normalizeBarcode(manual);
    if (!barcode) {
      setError(barcodeError(manual) ?? 'Bitte eine vollständige EAN eingeben.');
      return;
    }
    setError(null);
    onBarcodeRef.current(barcode);
  }

  // `open` is false on every server render -- it only turns true on a click -- but the
  // portal target is checked anyway rather than left as an implicit invariant.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-50"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode scannen"
    >
      <header className="relative flex h-16 shrink-0 items-center justify-between px-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Scanner schließen"
          className="text-zinc-50 hover:bg-white/10 hover:text-zinc-50"
          onClick={() => onOpenChange(false)}
        >
          <IconX />
        </Button>
        <div className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold uppercase tracking-[0.05em]">
          Barcode
        </div>
        <div className="w-10" />
      </header>

      <div className="relative flex-1 overflow-hidden bg-zinc-800">
        {state === 'unavailable' ? (
          <CameraUnavailable reason={reason} insecureContext={insecureContext} />
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 size-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <Viewfinder starting={state === 'starting'} />
          </>
        )}

        <div className="absolute inset-x-4 bottom-4">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
              EAN manuell eingeben
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                inputMode="numeric"
                placeholder="13-stellige Nummer"
                aria-label="EAN manuell eingeben"
                className="border-b-white/30 font-mono text-zinc-50 placeholder:text-zinc-500"
              />
              <Button
                variant="outline"
                className="shrink-0 border-white/30 bg-transparent text-zinc-50 hover:bg-white/10 hover:text-zinc-50"
                onClick={submitManual}
                disabled={busy}
              >
                Suchen
              </Button>
            </div>
          </label>
          {error && (
            <p className="mt-2 text-xs text-red-300" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      {children}
    </div>,
    document.body,
  );
}

/** The bottom sheet a result rides in: grab handle, light surface over the dark scanner. */
export function CaptureSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-[75vh] shrink-0 overflow-y-auto border-t bg-popover text-foreground">
      <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-muted" />
      <div className="mx-auto max-w-2xl px-4 pb-4 pt-3.5">{children}</div>
    </div>
  );
}

/** The corner-bracketed frame and scan line the camera image sits behind. */
function Viewfinder({ starting }: { starting: boolean }) {
  const corner = 'absolute size-8 border-zinc-50';
  return (
    <>
      <div className="absolute left-1/2 top-[44%] h-40 w-[250px] -translate-x-1/2 -translate-y-1/2">
        <div className={`${corner} left-0 top-0 border-l-2 border-t-2`} />
        <div className={`${corner} right-0 top-0 border-r-2 border-t-2`} />
        <div className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
        <div className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
        <div className="absolute inset-x-2 top-1/2 h-0.5 bg-zinc-50" />
      </div>
      <div className="absolute inset-x-0 top-[calc(44%+110px)] text-center text-xs uppercase tracking-[0.12em] text-zinc-400">
        {starting ? 'Kamera wird gestartet …' : 'EAN im Rahmen halten'}
      </div>
    </>
  );
}

function CameraUnavailable({
  reason,
  insecureContext,
}: {
  reason: string | null;
  insecureContext: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 pb-40 text-center">
      <div className="flex items-center gap-2 text-destructive">
        <IconCameraOff className="size-4" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Keine Kamera</span>
      </div>
      <p className="text-sm text-zinc-200">
        {reason ?? 'Kamerazugriff ist nicht erlaubt oder nicht verfügbar.'} Du kannst die EAN
        eingeben.
      </p>
      <p className="text-xs text-zinc-400">
        {insecureContext
          ? 'Die Seite über HTTPS oder localhost öffnen und erneut versuchen.'
          : 'Zugriff in den Browser-Einstellungen erlauben und erneut versuchen.'}
      </p>
    </div>
  );
}
