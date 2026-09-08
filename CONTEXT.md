# Context

Domain vocabulary for the Workout Tracker. This is a single-context repo — one `CONTEXT.md`,
one `docs/adr/`, covering both `apps/backend` and `apps/frontend`.

Routes and code identifiers are English; user-facing labels are German (Zyklen, Vorlagen,
Verlauf, Ernährung). When a concept below has a code name, that name is what the models,
services and types use; the German term is what the UI shows and what issues and ADRs should
say.

## Glossary

### Ernährung (nutrition)

- **Abschnitt** — a named division of a user's eating day: **Frühstück**, **Mittagessen**,
  **Abendessen**, **Snacks** by default. Per user, with a 1-based contiguous `order` (the same
  invariant as `WorkoutDay.order`) and an `archivedAt`. Four are created with every account
  and backfilled for older ones. An archived Abschnitt disappears from new days but still
  shows on past days that already have entries in it. Code: `MealSlot`.

- **Eintrag** — one logged item inside an Abschnitt on one calendar day: a name and its kcal,
  Kohlenhydrate, Protein and Fett. The nutrients are a **snapshot** taken when it is logged —
  a quantity change rescales them proportionally, they are never recomputed from a Lebensmittel
  (see [ADR-0002](docs/adr/0002-diary-entries-are-snapshots.md)). `localDate` is client-stamped
  and the `X-Timezone` header decides "today", exactly as for a workout. Code: `DiaryEntry`.

- **Schnelleintrag** — an Eintrag typed in directly (name + kcal + macros) with no Lebensmittel
  or Mahlzeit behind it. Not a separate type: it is a `DiaryEntry` with `foodId` and `mealId`
  null. For restaurant or canteen food you do not want in the shared library.

- **Lebensmittel** (food) and **Mahlzeit** (meal, a saved combination of foods) — the shared
  library an Eintrag can be logged from. Introduced in later tickets (#143, #144, #147); a
  Mahlzeit is a *live* reference in its editor but expands into snapshotted entries when
  logged. Listed here because Schnelleintrag is defined by their absence.

### Tracked nutrients

Only **kcal**, **Kohlenhydrate** (carbs), **Protein** and **Fett** (fat). No micronutrients.
Macro energy is 4 / 4 / 9 kcal per gram.
