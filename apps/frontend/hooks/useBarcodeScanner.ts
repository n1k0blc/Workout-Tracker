'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBarcodeReader, type BarcodeReader } from '@/lib/barcode-detector';
import { normalizeBarcode } from '@/lib/barcode';

/**
 * The camera half of the barcode scanner (#149).
 *
 * Opens the rear camera, decodes frames off a `<video>` until a code reads cleanly, and hands
 * the caller the canonical barcode. Every way this can fail collapses into `unavailable` plus
 * a German sentence -- the UI's answer is the same in all of them: offer the manual EAN field.
 *
 * `getUserMedia` needs a secure context, which is why the insecure case is called out by name:
 * over plain HTTP on a phone the camera is simply absent, with no permission prompt to explain
 * it. See `docs/barcode-scanner-testing.md`.
 */

export type ScannerState = 'starting' | 'scanning' | 'unavailable';

/** How often to run the decoder. ~8/s reads fast without pinning a phone's CPU. */
const DECODE_INTERVAL_MS = 120;

const CAMERA_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Kamerazugriff wurde abgelehnt.',
  NotFoundError: 'Dieses Gerät hat keine nutzbare Kamera.',
  NotReadableError: 'Die Kamera wird bereits von einer anderen App verwendet.',
  OverconstrainedError: 'Keine passende Kamera gefunden.',
  SecurityError: 'Kamerazugriff ist in diesem Kontext nicht erlaubt.',
};

function cameraMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? '';
  return CAMERA_MESSAGES[name] ?? 'Die Kamera konnte nicht gestartet werden.';
}

export function useBarcodeScanner({
  active,
  onDetected,
}: {
  /** Run the camera. False tears the stream down -- a paused scanner must not hold the light. */
  active: boolean;
  onDetected: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BarcodeReader | null>(null);
  const [state, setState] = useState<ScannerState>('starting');
  const [reason, setReason] = useState<string | null>(null);
  const [insecureContext, setInsecureContext] = useState(false);

  // Held in a ref so a new callback identity never restarts the camera mid-scan.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fail = (message: string, insecure = false) => {
      if (cancelled) return;
      setInsecureContext(insecure);
      setReason(message);
      setState('unavailable');
    };

    (async () => {
      setState('starting');
      setReason(null);
      setInsecureContext(false);

      // Plain HTTP hides `mediaDevices` entirely, so this is not a permission problem and
      // saying "allow camera access" would send someone hunting through settings for nothing.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        fail(
          'Die Kamera braucht HTTPS. Über eine unverschlüsselte Verbindung gibt der Browser sie nicht frei.',
          true,
        );
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch (error) {
        fail(cameraMessage(error));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      try {
        readerRef.current ??= await createBarcodeReader();
      } catch {
        stop();
        fail('Der Barcode-Decoder konnte nicht geladen werden.');
        return;
      }
      if (cancelled) return;

      const video = videoRef.current;
      if (!video) {
        stop();
        fail('Die Kameravorschau konnte nicht gestartet werden.');
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay was refused; the stream is still attached and usually starts on its own.
      }
      if (cancelled) return;
      setState('scanning');

      let busy = false;
      // One barcode per scanning session. Stopping the loop takes a React render to reach
      // here via `active`, and the camera is still pointed at the same barcode meanwhile, so
      // without this the next few ticks report it again -- each one a duplicate lookup, and a
      // result sheet that rebuilds under the user's finger just as they reach for it.
      let handled = false;
      timer = setInterval(async () => {
        // A decode can outlast the interval on a slow phone -- skip rather than pile up.
        if (busy || handled || cancelled || !readerRef.current || video.readyState < 2) return;
        busy = true;
        try {
          for (const result of await readerRef.current.detect(video)) {
            const barcode = normalizeBarcode(result.rawValue);
            // A misread is common at an angle; ignore it and let the next frame try again.
            if (barcode && !cancelled && !handled) {
              handled = true;
              onDetectedRef.current(barcode);
              break;
            }
          }
        } catch {
          // One bad frame is not a broken scanner.
        } finally {
          busy = false;
        }
      }, DECODE_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stop();
    };
  }, [active, stop]);

  return { videoRef, state, reason, insecureContext };
}
