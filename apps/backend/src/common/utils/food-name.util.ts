import { Logger } from '@nestjs/common';
import { ApiLocale, DEFAULT_LOCALE, toPrismaLocale } from './locale.util';

type FoodSourceName = 'SEED' | 'OPEN_FOOD_FACTS' | 'USER';
type PrismaLocale = 'DE' | 'EN';

/** What the name resolver needs of a Food row loaded with its `translations`. */
export interface TranslatableFood {
  id: string;
  name: string;
  source: FoodSourceName;
  translations: { locale: PrismaLocale; name: string }[];
}

/** What the label resolver needs of a FoodPortion row loaded with its `translations`. */
export interface TranslatablePortion {
  id: string;
  label: string;
  translations: { locale: PrismaLocale; label: string }[];
}

/** Relation selects for callers that need to resolve names -- the one place they are spelled. */
export const FOOD_TRANSLATIONS_SELECT = { select: { locale: true, name: true } } as const;
export const PORTION_TRANSLATIONS_SELECT = { select: { locale: true, label: true } } as const;

const logger = new Logger('FoodTranslation');

/**
 * The value `pick` extracts for `locale`, falling back like ADR-0006: requested locale, then
 * the default locale, then any row, then `base` -- never empty. Each fallback is logged.
 */
function resolve<T extends { locale: PrismaLocale }>(
  rows: T[],
  pick: (row: T) => string,
  base: string,
  locale: ApiLocale,
  what: string,
  warn: (message: string) => void,
): string {
  const exact = rows.find((r) => r.locale === toPrismaLocale(locale));
  if (exact) return pick(exact);

  const fallback = rows.find((r) => r.locale === toPrismaLocale(DEFAULT_LOCALE)) ?? rows[0];
  warn(`${what} has no "${locale}" translation`);
  return fallback ? pick(fallback) : base;
}

/**
 * The display name of a food in `locale` (ADR-0007). Only `SEED` foods are translated:
 * `OPEN_FOOD_FACTS` rows are market-filtered German products and `USER` foods are user content,
 * so both render verbatim whatever rows exist.
 */
export function resolveFoodName(
  food: TranslatableFood,
  locale: ApiLocale,
  warn: (message: string) => void = (m) => logger.warn(m),
): string {
  if (food.source !== 'SEED') return food.name;
  return resolve(food.translations, (t) => t.name, food.name, locale, `Food ${food.id}`, warn);
}

/** The label of a portion in `locale`; same rules as {@link resolveFoodName}, keyed on the parent's source. */
export function resolvePortionLabel(
  portion: TranslatablePortion,
  foodSource: FoodSourceName,
  locale: ApiLocale,
  warn: (message: string) => void = (m) => logger.warn(m),
): string {
  if (foodSource !== 'SEED') return portion.label;
  return resolve(
    portion.translations,
    (t) => t.label,
    portion.label,
    locale,
    `FoodPortion ${portion.id}`,
    warn,
  );
}
