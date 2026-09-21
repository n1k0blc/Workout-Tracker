import { Logger } from '@nestjs/common';
import { ApiLocale, DEFAULT_LOCALE, toPrismaLocale } from './locale.util';

/** What the name resolver needs of an Exercise row loaded with its `translations`. */
export interface TranslatableExercise {
  id: string;
  name: string;
  isCustom: boolean;
  translations: { locale: 'DE' | 'EN'; name: string }[];
}

/** Relation include for callers that need to resolve names -- the one place it is spelled. */
export const EXERCISE_TRANSLATIONS_SELECT = { select: { locale: true, name: true } } as const;

const logger = new Logger('ExerciseTranslation');

/**
 * The display name of an exercise in `locale` (ADR-0006). Custom exercises are user content
 * and render verbatim. A catalogue exercise falls back to the default locale, then to any
 * row, then to the base `name` column -- never to an empty string, which would render an
 * empty button. Each fallback is logged, because a silent one is how an app stays partly
 * translated unnoticed.
 */
export function resolveExerciseName(
  exercise: TranslatableExercise,
  locale: ApiLocale,
  warn: (message: string) => void = (m) => logger.warn(m),
): string {
  if (exercise.isCustom) return exercise.name;

  const find = (wanted: 'DE' | 'EN') => exercise.translations.find((t) => t.locale === wanted);
  const exact = find(toPrismaLocale(locale));
  if (exact) return exact.name;

  const fallback = find(toPrismaLocale(DEFAULT_LOCALE)) ?? exercise.translations[0];
  warn(`Exercise ${exercise.id} has no "${locale}" translation`);
  return fallback?.name ?? exercise.name;
}
