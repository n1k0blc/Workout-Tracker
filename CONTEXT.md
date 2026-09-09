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

- **Favoriten / Zuletzt** — the two extra tabs the picker (and the Mahlzeit editor's Zutat
  search) gain next to "Alle". A star on every picker row toggles a per-user favorite;
  favoriting happens only where you log, never in the Vorlagen tabs. **Favoriten** lists the
  starred Lebensmittel and Mahlzeiten ordered by when each was last logged (a never-logged
  favorite sorts last, by when it was starred); unstarring removes the row. **Zuletzt** is
  derived from the diary, no table: the last 20 *distinct* foods and meals the user logged,
  most recent first — an Eintrag expanded from a Mahlzeit counts toward the meal, not its
  ingredient foods. In "Alle", a starred row floats above non-favorites of equal name order.
  The Zutat search is foods-only (a Mahlzeit can't be an ingredient). Both tabs drop an item
  whose Lebensmittel / Mahlzeit has since been soft-deleted. Code: `FoodFavorite` /
  `MealFavorite`, `FavoritesService`, `PickerService`.

- **Barcode-Scan** — the camera (or the manual EAN field beside it) resolving a product to a
  Lebensmittel, from the picker and from the Lebensmittel tab. The Lebensmittel editor's EAN
  field scans too, but only to fill itself in — capturing a code and resolving one are separate
  (`BarcodeCapture` / `BarcodeScannerSheet`). A code is only ever acted on in
  its **canonical** form: EAN-13, EAN-8 and UPC-A are accepted, the check digit is verified,
  and a UPC-A is widened to the EAN-13 it is — so one physical product cannot become two rows.
  The **miss chain** is local library → live Open Food Facts → nothing: a local hit answers
  with no network call, a miss is looked up live and **cached as a global `OPEN_FOOD_FACTS`
  food** with `lastSyncedAt` (the same shape the bulk import writes), and a double miss opens
  "Lebensmittel anlegen" with the barcode prefilled. A rescanned barcode whose food was
  soft-deleted **undeletes that row** rather than creating a duplicate — the barcode is the
  product's global identity and is unique across deleted rows too. The live lookup drops two of
  the bulk import's rules on purpose: no Germany filter and no 13-digit-only rule, because the
  user is physically holding the thing they scanned. Decoding uses the browser's own
  `BarcodeDetector` where there is one and a zxing WebAssembly fallback where there is not
  (Safari, so every iPhone); either way the camera needs HTTPS or `localhost`, see
  [docs/barcode-scanner-testing.md](docs/barcode-scanner-testing.md). Code: `normalizeBarcode`,
  `FoodsService.lookupByBarcode`, `OffLookupService`.

- **Open-Food-Facts-Bibliothek** — the shared `OPEN_FOOD_FACTS` foods, filled by a one-off bulk
  import of the German subset (`pnpm run import:off`) and kept fresh by a weekly delta sync
  (`sync-off-foods.sh`, Sundays 04:00 on the Pi, after the backup). Open Food Facts publishes
  one product in three shapes — flat CSV columns, `nutrition.input_sets` in the JSONL export and
  the daily deltas, and the legacy `nutriments` block from the API — so each gets a thin adapter
  and everything after it is shared: the market filter (`isSoldInGermany`), the quality gate
  (`rejectOffProduct`: valid EAN-13, plausible per-100 values, macros within ±15% of the stated
  kcal) and the mapping. A parity test pins all three shapes to the same normalized product, so
  a row imported from the CSV and later refreshed from a delta does not churn. The sync only ever
  writes rows it owns — a barcode held by a USER or SEED food is left alone — and only ~13 days
  of deltas are published, so a run that is skipped for longer logs a warning to re-run the full
  import. Its last-run marker is a host file (`~/logs/off-sync.state`), falling back to the newest
  `lastSyncedAt` in the library. Code: `off-mapping`, `off-import`, `off-delta`, `off-sync`.

### Tracked nutrients

Only **kcal**, **Kohlenhydrate** (carbs), **Protein** and **Fett** (fat). No micronutrients.
Macro energy is 4 / 4 / 9 kcal per gram.
