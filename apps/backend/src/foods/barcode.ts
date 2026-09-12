/**
 * Barcode validation and canonicalisation for the scanner (#149).
 *
 * One gate for both ways a code arrives -- decoded from the camera, or typed into the manual
 * EAN field -- so a bad check digit never reaches the lookup and every barcode we store is in
 * one shape. `apps/frontend/lib/barcode.ts` is the mirror of this, for the client-side check.
 */

/** The three symbologies the scanner reads. UPC-A is 12 digits, and is an EAN-13 zero-padded. */
const SUPPORTED_LENGTHS = [8, 12, 13];

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

/**
 * The canonical form of a scanned or typed barcode, or null when it is not a valid EAN-8,
 * UPC-A or EAN-13. A UPC-A widens to the EAN-13 it is (the padding zero leaves the check
 * digit valid), so the same physical product cannot end up as two rows depending on which
 * decoder read it.
 */
export function normalizeBarcode(raw: string): string | null {
  const digits = (raw ?? '').replace(/[\s-]/g, '');
  if (!SUPPORTED_LENGTHS.includes(digits.length)) return null;
  if (!/^\d+$/.test(digits)) return null;
  if (!hasValidCheckDigit(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

/**
 * EAN-13 with a valid check digit. The bulk Open Food Facts import needs exactly this,
 * narrower rule -- see the comment on `rejectOffProduct` in `off-mapping.ts` for why it turns
 * away the 8-digit codes that {@link normalizeBarcode} accepts.
 */
export function isValidEan13(barcode: string): boolean {
  return /^\d{13}$/.test(barcode) && hasValidCheckDigit(barcode);
}
