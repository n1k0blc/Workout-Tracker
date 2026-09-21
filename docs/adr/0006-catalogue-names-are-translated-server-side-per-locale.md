# 6. Catalogue names are translated server-side, one row per locale

Date: 2026-09-21

## Status

Accepted

## Context

The UI is localized (#176), but the 115 catalogue Übungen carry a single German `Exercise.name`.
Their names have to display in the user's locale, and every later catalogue translation
(templates, foods) will want the same answer. Three places could own the translation:

- **The client**, from a bundled dictionary keyed by exercise id. It splits the data from the
  code that reads it, and every response that carries an `exerciseName` (workouts, templates,
  cycles, analytics) would need patching on the client.
- **A JSON column** on `Exercise` (`{ de, en }`). No foreign key, no per-locale uniqueness, and
  a missing locale is invisible to the database.
- **A per-entity translation table** with a real foreign key, resolved by the API before the
  response is built.

## Decision

**`ExerciseTranslation(exerciseId, locale, name)`, unique on `(exerciseId, locale)`, with a
foreign key to `Exercise` that cascades on delete.** The API resolves the name; DTO shapes do
not change, so no client learns about locales to render an exercise.

- **The locale arrives as `X-Locale`**, read by the `@ClientLocale()` param decorator — modelled
  on `@ClientToday()` / `X-Timezone`, including its graceful fallback: an absent or unsupported
  header answers in the default locale (`de`) rather than failing. The API client sends it on
  every request.
- **Custom exercises (`isCustom = true`) are user content** and are never translated: they
  render verbatim, whatever rows exist.
- **Fallback never yields an empty name**: requested locale, then the default locale, then any
  available row, then the base `Exercise.name`. An empty name renders an empty button. Every
  fallback is logged with the exercise id and the locale, because a silent one is how an app
  stays 80% translated for two years unnoticed.
- **The seed fails** if any catalogue row would lack `de` or `en` (`ExerciseTranslations-en.csv`
  supplies English; German is the existing catalogue name), so a gap is a broken seed, not a
  runtime surprise. The migration backfills `de` from the existing names.
- **Search and ordering of the exercise list act on the resolved name**, in memory, after the
  query — the catalogue is ~115 rows plus one user's customs.

`Exercise.name` stays: it is the German source, the fallback of last resort, and what custom
exercises are.

## Consequences

Every read path that returns an exercise name must load `translations` and go through
`resolveExerciseName` (`common/utils/exercise-name.util.ts`); the tree include and mapper
(`workout-tree.service.ts`) cover workouts, blueprints and templates in one place.

**Exit condition.** If catalogue names ever need server-side search or sorting beyond current
volumes — thousands of rows, pagination, fuzzy matching — the in-memory filter in
`ExercisesService.findAll` stops being adequate, and the read path should be revisited (a
locale-scoped join or a denormalised search column), not patched.
