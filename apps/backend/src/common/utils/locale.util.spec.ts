import {
  fromPrismaLocale,
  resolveRegisterLocale,
  resolveUnitSystemFromAcceptLanguage,
  toPrismaLocale,
  withApiLocale,
} from './locale.util';

describe('resolveRegisterLocale', () => {
  it('accepts a supported locale sent by the client', () => {
    expect(resolveRegisterLocale('de')).toBe('de');
    expect(resolveRegisterLocale('en')).toBe('en');
  });

  it('falls back to de when the header is absent', () => {
    expect(resolveRegisterLocale(undefined)).toBe('de');
  });

  it('falls back to de when the header is not a supported locale', () => {
    expect(resolveRegisterLocale('fr')).toBe('de');
  });

  it('falls back to de when the header arrived more than once', () => {
    expect(resolveRegisterLocale(['de', 'en'])).toBe('de');
  });
});

describe('resolveUnitSystemFromAcceptLanguage', () => {
  it('seeds imperial only for en-US', () => {
    expect(resolveUnitSystemFromAcceptLanguage('en-US')).toBe('IMPERIAL');
    expect(resolveUnitSystemFromAcceptLanguage('en-US,en;q=0.9')).toBe('IMPERIAL');
  });

  it('seeds metric for every other Accept-Language, including bare "en"', () => {
    expect(resolveUnitSystemFromAcceptLanguage('en')).toBe('METRIC');
    expect(resolveUnitSystemFromAcceptLanguage('en-GB')).toBe('METRIC');
    expect(resolveUnitSystemFromAcceptLanguage('de-DE,de;q=0.9')).toBe('METRIC');
  });

  it('seeds metric when the header is absent', () => {
    expect(resolveUnitSystemFromAcceptLanguage(undefined)).toBe('METRIC');
  });

  it('never throws on a malformed header', () => {
    expect(resolveUnitSystemFromAcceptLanguage('not-a-locale-tag-!!!')).toBe('METRIC');
    expect(resolveUnitSystemFromAcceptLanguage('')).toBe('METRIC');
  });

  it('uses the first element when the header arrived more than once', () => {
    expect(resolveUnitSystemFromAcceptLanguage(['en-US', 'de-DE'])).toBe('IMPERIAL');
    expect(resolveUnitSystemFromAcceptLanguage(['de-DE', 'en-US'])).toBe('METRIC');
  });

  it('ignores an RFC 7231 quality value on the first tag', () => {
    expect(resolveUnitSystemFromAcceptLanguage('en-US;q=1.0')).toBe('IMPERIAL');
    expect(resolveUnitSystemFromAcceptLanguage('en-US;q=1.0,en;q=0.9')).toBe('IMPERIAL');
  });
});

describe('toPrismaLocale / fromPrismaLocale', () => {
  it('round-trips both supported locales', () => {
    expect(toPrismaLocale('de')).toBe('DE');
    expect(toPrismaLocale('en')).toBe('EN');
    expect(fromPrismaLocale('DE')).toBe('de');
    expect(fromPrismaLocale('EN')).toBe('en');
  });
});

describe('withApiLocale', () => {
  it('maps a Prisma row locale to the wire type and keeps every other field', () => {
    expect(withApiLocale({ id: 'u1', email: 'a@b.com', locale: 'EN' as const })).toEqual({
      id: 'u1',
      email: 'a@b.com',
      locale: 'en',
    });
  });
});
