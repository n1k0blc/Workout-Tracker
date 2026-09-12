# 2. A diary entry is a snapshot; a meal is a live reference

Date: 2026-09-08

## Status

Accepted

## Context

The Ernährung section logs what the user ate into `DiaryEntry` rows. An entry can come from
three places: a `Food` from the shared library, a `Meal` (a saved combination of foods), or a
**Schnelleintrag** — a name and raw kcal/macros typed in on the spot, with nothing behind it.

Foods and meals are editable shared data. Anyone can fix a wrong value on a `Food`; the
creator can re-balance a `Meal`. The question this ADR settles is what a *past* `DiaryEntry`
shows after the thing it was logged from changes underneath it — or is soft-deleted.

Two coherent answers:

- **Live**: an entry stores `foodId` + a quantity and recomputes kcal/macros from the current
  `Food` on every read. Editing a food's values retroactively corrects every day it appears
  on.
- **Snapshot**: an entry copies the resolved name and kcal/macros at log time and never looks
  at the `Food` again. Editing the food changes nothing already logged.

Live is wrong for a diary. "Tuesday: 1.842 kcal" is a fact about Tuesday. If correcting a
typo in "Haferflocken" three weeks later silently moves Tuesday's total, the diary stops
being a record and becomes a view over mutable data — and the analytics chart built on those
totals reslices itself every time anyone touches the library. A soft-deleted food would leave
old entries with nothing to resolve at all.

Meals are the opposite case. A `Meal` is a *recipe*, and its expansion into entries happens
once, at log time — after that the individual food entries stand on their own. The meal is a
live reference only in the editor, where changing an ingredient should change the recipe going
forward. It never reaches back into logged days.

## Decision

**`DiaryEntry` stores a snapshot.** At creation it copies `name`, `kcal`, `carbs`, `protein`
and `fat`; after that those columns are the entry, full stop. `foodId` and `mealId` are kept
(nullable) for grouping, "recently used", and linking back to the source — never as inputs to
a recompute.

**A quantity edit rescales the snapshot proportionally.** New values are the stored ones times
`newQuantity / oldQuantity`. It does not re-read the `Food`, so an entry logged before a
library correction keeps the numbers it was logged with, and one logged after gets the new
ones — each entry reflects the library as it stood when it was made.

**A `Schnelleintrag` is the same row with `foodId` and `mealId` null.** No special table, no
flag: "has no food behind it" is the whole difference, and it falls out of the snapshot model
for free.

**Meals expand at log time.** Logging a `Meal` writes one snapshotted `DiaryEntry` per
ingredient, tagged with `mealId` for grouping. The `Meal`/`MealItem` records stay live for the
editor only. (Meal logging itself lands in #147; this ADR fixes the model now so #147 does not
have to migrate.)

## Consequences

- Full float precision is stored, and rounding is a display concern. A quantity taken up and
  back down (1 → 4 → 1) returns to the original snapshot; ratios that are not exact in binary
  float can leave a sub-rounding residue, which never surfaces in the UI.
- `Food` and `Meal` get soft delete (`deletedAt`) for the library UI, but a deleted row does
  not break history — nothing logged depends on it resolving.
- "What did I eat that day" and "what's in the library now" are answerable independently and
  can legitimately disagree. That is the point.
- Editing a `Food`'s values is not retroactive, and the food editor should say so when that
  ships (#143).
- The service never joins `DiaryEntry` to `Food` to build a day. `getDay` reads entries and
  slots and nothing else.

## Rejected alternatives

- **Live recompute from `foodId`.** Makes the diary and the analytics chart mutable under
  library edits, and leaves soft-deleted foods with unresolvable entries. Rejected above.
- **Snapshot, but re-sync on the food editor's "save" for entries in the last N days.** A
  compromise with a magic window and a surprising partial retroactivity. No clear owner for
  "N", and it still means some past days move.
- **A dedicated `QuickEntry` table separate from food-backed entries.** Two code paths for
  totals, deletion, rescale and recents, to encode a distinction that is just `foodId IS
  NULL`.

## Related

`localDate` is client-stamped and `X-Timezone` decides "today", identical to `Workout`
(ADR-relevant discussion in `AGENTS.md` → "Today's workout is the one whose weekday is
today"). `MealSlot.order` follows the same 1-based contiguous invariant as `WorkoutDay.order`.
