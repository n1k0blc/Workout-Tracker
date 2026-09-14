/** Lower-cased: Node normalises incoming header names. */
export const LOCALE_HEADER = 'x-locale';

export const SUPPORTED_LOCALES = ['de', 'en'] as const;
export type ApiLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * The `Locale` -> lowercase wire-type mapping. The Prisma enum stays SCREAMING_SNAKE_CASE
 * to match every other enum in the schema (`CycleStatus`, `SetType`, ...); next-intl's
 * locale strings and the `[locale]` URL segment stay lowercase. This is the only place
 * the two representations meet.
 */
export function toPrismaLocale(locale: ApiLocale): 'DE' | 'EN' {
  return locale.toUpperCase() as 'DE' | 'EN';
}

export function fromPrismaLocale(locale: 'DE' | 'EN'): ApiLocale {
  return locale.toLowerCase() as ApiLocale;
}

/**
 * Maps a Prisma row's `locale` to the lowercase wire type, keeping every other field as-is.
 * One choke point for this conversion so a query that starts selecting `locale` can't
 * forget to map it before the row reaches a `UserDto`-typed response.
 */
export function withApiLocale<T extends { locale: 'DE' | 'EN' }>(
  row: T,
): Omit<T, 'locale'> & { locale: ApiLocale } {
  return { ...row, locale: fromPrismaLocale(row.locale) };
}

/**
 * The locale the registration form was submitted in, read off the `X-Locale` header the
 * frontend sends on every request (mirrors the existing `X-Timezone` pattern). Falls back
 * to `de` for a missing/unsupported/duplicated header -- in practice the frontend always
 * sends a real value; the fallback only matters for direct API calls that skip it.
 */
export function resolveRegisterLocale(header?: string | string[]): ApiLocale {
  if (typeof header !== 'string') return 'de';
  return (SUPPORTED_LOCALES as readonly string[]).includes(header) ? (header as ApiLocale) : 'de';
}

/**
 * The one-time `unitSystem` seed at registration: `en-US` seeds imperial, every other
 * Accept-Language (including bare "en") seeds metric. Reads only the first/most-preferred
 * tag -- a one-time seed, not full RFC 4647 negotiation -- and never throws on a malformed
 * header.
 */
export function resolveUnitSystemFromAcceptLanguage(
  header?: string | string[],
): 'METRIC' | 'IMPERIAL' {
  const value = Array.isArray(header) ? header[0] : header;
  // Strip a trailing RFC 7231 quality value (";q=0.9") before parsing -- a tag is legal
  // with one even as the first/most-preferred entry, and Intl.Locale rejects it outright.
  const firstTag = value?.split(',')[0]?.split(';')[0]?.trim();
  if (!firstTag) return 'METRIC';

  try {
    const { language, region } = new Intl.Locale(firstTag);
    return language === 'en' && region === 'US' ? 'IMPERIAL' : 'METRIC';
  } catch {
    return 'METRIC';
  }
}
