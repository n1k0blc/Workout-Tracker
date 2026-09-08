import { isValidEan13, normalizeBarcode } from './barcode';

/**
 * The scanner's barcode gate (#149). A scan and a manually typed EAN go through the same
 * function, so the check digit is verified once and every stored barcode is canonical.
 */
describe('normalizeBarcode', () => {
  it('accepts an EAN-13 with a valid check digit, unchanged', () => {
    expect(normalizeBarcode('4025500287955')).toBe('4025500287955');
  });

  it('accepts an EAN-8 with a valid check digit, unchanged', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074');
  });

  it('widens a UPC-A to the EAN-13 it is, so one product has one barcode', () => {
    // 036000291452 is the textbook UPC-A; as an EAN-13 it is the same code zero-padded, and
    // the check digit stays valid because the padding adds a zero in an odd position.
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
  });

  it('strips whitespace and separators the manual field invites', () => {
    expect(normalizeBarcode(' 4025500287955 ')).toBe('4025500287955');
    expect(normalizeBarcode('4025500-287955')).toBe('4025500287955');
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

describe('isValidEan13', () => {
  it('is the 13-digit-only gate the bulk import needs', () => {
    expect(isValidEan13('4025500287955')).toBe(true);
    // Checksum-valid EAN-8, but not 13 digits -- the import rejects it (see off-mapping).
    expect(isValidEan13('96385074')).toBe(false);
  });
});
