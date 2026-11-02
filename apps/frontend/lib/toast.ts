import { toast } from 'sonner';

/**
 * The one way to show a toast (#222). A toast is for what does not belong to a field: a flow rule
 * ("log the previous set first") or a server or network failure. Callers pick the kind and never
 * a duration, so the same kind lives equally long on every screen. Field problems use
 * `FieldError` / `FieldWarning` instead. Pass already-translated text.
 */
export const TOAST_DURATION_MS = {
  success: 3000,
  info: 4000,
  warning: 6000,
  error: 8000,
} as const;

export const notify = {
  success: (message: string) => toast.success(message, { duration: TOAST_DURATION_MS.success }),
  info: (message: string) => toast.info(message, { duration: TOAST_DURATION_MS.info }),
  warning: (message: string) => toast.warning(message, { duration: TOAST_DURATION_MS.warning }),
  error: (message: string) => toast.error(message, { duration: TOAST_DURATION_MS.error }),
};
