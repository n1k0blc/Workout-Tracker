import { describe, expect, it } from 'vitest';
import { normalizeBarcode, barcodeError } from './barcode';

/**
 * The manual EAN field's gate (#149). It is the mirror of `apps/backend/src/foods/barcode.ts`:
 * the client refuses a bad check digit before spending a request, the server refuses it again
 * because the client is not the authority.
 */
describe('normalizeBarcode', () => {
  it('accepts an EAN-13 with a valid check digit, unchanged', () => {
    expect(normalizeBarcode('4025500287955')).toBe('4025500287955');
  });

  it('accepts an EAN-8 with a valid check digit, unchanged', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074');
  });

  it('widens a UPC-A to the EAN-13 it is, so one product has one barcode', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
  });

  it('strips the spaces and dashes people type off a package', () => {
    expect(normalizeBarcode(' 4025500 287955 ')).toBe('4025500287955');
    expect(normalizeBarcode('40255-00287955')).toBe('4025500287955');
  });

  it.each([
    ['a wrong check digit', '4025500287956'],
    ['a wrong EAN-8 check digit', '96385075'],
    ['a wrong UPC-A check digit', '036000291453'],
    ['too few digits', '1234567'],
    ['a length no symbology uses', '123456789'],
    ['too many digits', '12345678901234'],
    ['non-digits', '402550028795X'],
    ['nothing at all', ''],
  ])('rejects %s', (_label, input) => {
    expect(normalizeBarcode(input)).toBeNull();
  });
});

describe('barcodeError', () => {
  it('says nothing while the field is empty or still being typed', () => {
    expect(barcodeError('')).toBeNull();
    expect(barcodeError('   ')).toBeNull();
    // Still too short to be any of the three -- not yet wrong, just unfinished.
    expect(barcodeError('40255')).toBeNull();
  });

  it('names a wrong check digit once the code is long enough to have one', () => {
    expect(barcodeError('4025500287956')).toMatch(/Prüfziffer/);
  });

  it('rejects non-digits immediately', () => {
    expect(barcodeError('40255abc')).toMatch(/Ziffern/);
  });

  it('says nothing about a code that is valid', () => {
    expect(barcodeError('4025500287955')).toBeNull();
    expect(barcodeError('96385074')).toBeNull();
  });
});
