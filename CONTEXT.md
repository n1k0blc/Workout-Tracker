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

- **Lebensmittel** — a food in the shared library, with nutrients per 100 g (or 100 ml when
  `isLiquid`) and zero or more named **Portionsgrößen** (`FoodPortion`: label + grams, one
  marked default). `source` is `SEED`, `OPEN_FOOD_FACTS` or `USER`. **Every Lebensmittel is
  visible to every user** regardless of creator — a deliberate divergence from custom
  exercises (see [ADR-0003](docs/adr/0003-user-created-foods-and-meals-are-shared.md)). Only
  the creator edits a `USER` food; `SEED` / `OPEN_FOOD_FACTS` are read-only for everyone.
  Deletion is soft; the `barcode` is a product's global identity. Creator names are never
  shown. `SEED` foods come from `FoodsSeed.csv` at the repo root and carry the CSV's `key`
  as `seedKey`, the stable identity `prisma db seed` upserts on. Code: `Food` / `FoodPortion`.

- **Mahlzeit** (meal, a saved combination of foods) — the other shared library an Eintrag can
  be logged from, built in the "Mahlzeiten" tab of Vorlagen. A Mahlzeit has a name and an
  ordered list of **Zutaten** (`MealItem`: a `Food` + a `quantity` in g/ml, `order` 1-based
  and contiguous from array position). It is a *live* reference in its editor and in the
  picker — the totals shown are recomputed from the referenced foods' current nutrients, so
  editing a food changes a meal's displayed total. Logging it is the opposite: the picker
  asks for a **Faktor** (0,5× / 1× / 1,5× / 2×) and the meal expands into one snapshotted
  `DiaryEntry` per ingredient (ADR-0002), each carrying the meal's id as a grouping tag so
  the Abschnitt page groups them under "MAHLZEIT &lt;name&gt;"; a single ingredient entry can
  then be edited or removed on its own. Same sharing rules as Lebensmittel (ADR-0003): every
  Mahlzeit is visible to every user, only the creator edits or deletes it (**403** otherwise),
  `createdById` is nullable so the row outlives its creator's account, deletion is soft, and
  the creator's name is never shown ("Meine" marker only). A Mahlzeit resolves and computes
  even when one of its foods has been soft-deleted; it cannot contain another Mahlzeit;
  duplicate names are allowed. Code: `Meal` / `MealItem`.

### Tracked nutrients

Only **kcal**, **Kohlenhydrate** (carbs), **Protein** and **Fett** (fat). No micronutrients.
Macro energy is 4 / 4 / 9 kcal per gram.
