/**
 * Barcode validation for the scanner's manual EAN field (#149).
 *
 * The mirror of `apps/backend/src/foods/barcode.ts`. Duplicated deliberately rather than
 * shared: it stops a typo before it costs a request, and lets the field say *why* a code is
 * wrong while it is being typed. The server validates again -- this copy is a convenience,
 * never the authority.
 */

/** The three symbologies the scanner reads. UPC-A is 12 digits, and is an EAN-13 zero-padded. */
const SUPPORTED_LENGTHS = [8, 12, 13];

/** Shortest code that can be complete -- below this the field is unfinished, not wrong. */
const SHORTEST = Math.min(...SUPPORTED_LENGTHS);

/**
 * The GTIN check digit rule, which EAN-8, UPC-A and EAN-13 all share: weight the digits 3, 1,
 * 3, … from the right of the payload, and the check digit is what rounds the sum up to a
 * multiple of ten.
 */
function hasValidCheckDigit(barcode: string): boolean {
  const digits = [...barcode].map(Number);
  const check = digits.pop() as number;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Whatever the user typed or the camera read, reduced to bare digits. */
function digitsOf(raw: string): string {
  return (raw ?? '').replace(/[\s-]/g, '');
}

/**
 * The canonical form of a barcode, or null when it is not a valid EAN-8, UPC-A or EAN-13. A
 * UPC-A widens to the EAN-13 it is, so the same product cannot end up as two library rows
 * depending on which decoder read it.
 */
export function normalizeBarcode(raw: string): string | null {
  const digits = digitsOf(raw);
  if (!SUPPORTED_LENGTHS.includes(digits.length)) return null;
  if (!/^\d+$/.test(digits)) return null;
  if (!hasValidCheckDigit(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

/**
 * Why the EAN field's contents were refused, or null when there is nothing specific to say.
 * Called on submit, so that a wrong code is named precisely -- a bad check digit and a
 * half-typed number are different mistakes and deserve different sentences. Returning null for
 * anything too short to be one of the three symbologies is what routes those to the caller's
 * generic "not finished yet" message instead of claiming the check digit is wrong, which a
 * code with no check digit position cannot be.
 */
export function barcodeError(raw: string): string | null {
  const digits = digitsOf(raw);
  if (digits.length === 0) return null;
  if (!/^\d+$/.test(digits)) return 'Eine EAN besteht nur aus Ziffern.';
  if (digits.length < SHORTEST) return null;
  if (normalizeBarcode(digits)) return null;
  if (!SUPPORTED_LENGTHS.includes(digits.length)) {
    return 'Eine EAN hat 8 oder 13 Ziffern (UPC 12).';
  }
  return 'Die Prüfziffer stimmt nicht. Bitte die Nummer prüfen.';
}
