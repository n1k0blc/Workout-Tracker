# 3. User-created foods and meals are a shared library

Date: 2026-09-08

## Status

Accepted

## Context

The app already has a user-scoped catalog: **exercises**. A system exercise is global and
read-only; a *custom* exercise is private — `isCustom = true`, `userId` set, and every query
filters it to its owner (`ExercisesService.findAll`, `validateAccessible`). Two users who
both invent "Bulgarian Split Squat (DB)" get two separate rows and never see each other's.

The Ernährung section needs a catalog too: **Lebensmittel** (`Food`), and later **Mahlzeit**
(`Meal`). The obvious move is to copy the exercise model — `source = USER`, `createdById`
set, filtered to the creator. This ADR is here because that copy is wrong, and the reason is
about what the two catalogs *are*.

An exercise catalog is small, curated, and essentially complete out of the box. A custom
exercise is a genuine personal variant — a particular gym's odd machine, a grip nobody else
uses. Keeping it private costs nothing; nobody else wants it.

A food catalog is the opposite: open-ended, and valuable exactly in proportion to its
coverage of the German-supermarket long tail. "Skyr natur 0,2 %", "Haferdrink Barista
ungesüßt", the specific store-brand muesli — there are tens of thousands of these, and the
first user to enter one has done work the next user would otherwise repeat. A barcode scan
that resolves against *someone else's* entry is the entire point of having the feature.
Private foods would mean everyone rebuilds the same catalog in parallel.

## Decision

**`Food` (and, when it lands, `Meal`) is a shared library. Every row is visible to every
user regardless of `createdById`.**

- **`source`** is `SEED` (curated German staples), `OPEN_FOOD_FACTS` (imported), or `USER`
  (someone entered it). Only `USER` rows carry a `createdById`.
- **Editing / deleting**: a `USER` food only by its `createdById` (API answers **403**
  otherwise); `SEED` and `OPEN_FOOD_FACTS` foods by nobody (**403** — the editor renders a
  read-only view with the reason and a "make your own copy" path).
- **Deletion is soft** (`deletedAt`). A deleted food drops out of search but still resolves
  by id, so diary entries and meals that point at it keep rendering. (Entries also snapshot
  their nutrients — ADR-0002 — so a deleted food never changes a past total; the id link is
  kept only for grouping and "recently used".)
- **`barcode` is the global identity of a product**: unique across the whole table,
  soft-deleted rows included. A future rescan of a soft-deleted barcode undeletes that row
  rather than inserting a duplicate.
- **Creator names are never shown.** A shared food has no byline. The only creator-derived
  fact the UI exposes is "this one is mine" (`editable` / the "Eigenes" badge).
- **No per-user visibility filter** on any food query. `editable` is computed per read from
  `source`, `createdById` and the current user.

## Consequences

- Food queries are simpler than exercise queries — no `OR: [{ global }, { mine }]`, just
  `deletedAt: null` plus the search term.
- Abuse vector: someone edits a widely-used `USER` food to nonsense. Mitigated by
  creator-only edit (they can only wreck their own) and by entries snapshotting nutrients
  (already-logged days are untouched). A shared "report / fork" flow and an admin role over
  globals are deliberately out of scope (listed as follow-ups on the epic).
- The similar-name hint on create, and "Ähnliche eigene Einträge" on the read-only view,
  both scope to the current user's own foods — the point is to stop *you* making a duplicate,
  not to browse the whole library inline.
- `Meal` will follow the same rules when #147 adds it: shared, creator-only edit, no nested
  meals, creator name never shown.

## Rejected alternatives

- **Per-user foods like custom exercises.** Every user rebuilds the catalog; barcode scans
  only ever hit your own entries; the seed and Open Food Facts import become the only shared
  data. Defeats the feature.
- **Shared, but any user can edit any `USER` food (a wiki).** One bad actor degrades the
  catalog for everyone with no attribution trail, and there is no snapshot protection on the
  *food* itself (only on entries). Creator-only edit is the cheapest guard that keeps the
  library trustworthy.
- **Hard delete with a "food is in use" check (like exercises).** Foods are referenced by
  snapshotted entries and by meals; the check would nearly always fail, and a genuinely
  unused food being hard-deleted still breaks a half-typed meal draft. Soft delete
  everywhere in the food domain is simpler to reason about.
