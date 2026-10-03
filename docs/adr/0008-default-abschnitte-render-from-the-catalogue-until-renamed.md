# 8. Default Abschnitte render from the message catalogue until the user renames them

Date: 2026-10-03

## Status

Accepted

## Context

Every account gets four Abschnitte at registration (Frühstück, Mittagessen, Abendessen,
Snacks). They are created per user, so they are *catalogue data that becomes user-owned rows
the moment they are written* (#189). Translating them at signup is not enough: a user who
switches locale later would keep German Abschnitte in an English app. But the user may also
rename any of them, and a typed name must win.

## Decision

**`MealSlot.seedKey`, nullable** — one of `breakfast`, `lunch`, `dinner`, `snacks`. The same
idea as `Food.seedKey`, though that one is an upsert identity and this one is a rendering key.

- While `seedKey` is set, the client renders the name from its message catalogue
  (`SlotNames.<seedKey>`, `useSlotName`) in the active locale. The API returns `seedKey`
  alongside `name` on both slot DTOs (`MealSlotDto`, `NutritionDaySlotDto`) and leaves the
  rendering to the client, because the catalogue lives there — unlike Übungen and Lebensmittel,
  whose rows are too many for a bundled dictionary (ADR-0006, ADR-0007).
- **Renaming sets `seedKey` to null, permanently.** The typed name then persists across locale
  switches. There is no way back to the catalogue name short of typing it.
- `name` stays the German source, the fallback for an unknown key, and what a renamed slot keeps.
- New accounts get the four defaults with `seedKey` set (`defaultMealSlotCreateData`, the one
  definition shared with the original backfill).
- **Backfill** (migration `20261004120000_add_meal_slot_seed_key`): existing rows still carrying
  a German default name acquire the matching key; renamed rows do not match and stay null. If a
  user holds two rows with the same default name, only the oldest is tagged.
- Archiving, `order` and its invariants are untouched; `seedKey` is independent of both.
- The icon follows `seedKey` too (`SlotIcon`), so it no longer depends on the German label.

## Consequences

A user who had, before this change, deliberately renamed an Abschnitt *to* a default German name
is indistinguishable from an untouched one and is tagged; their slot then follows the locale.
Acceptable: the visible result is the same name in German.

The whole-day copy fallback (`ensureActiveSlot`, "Sonstiges") matches on the stored `name`, as
before; it is not a default Abschnitt and carries no `seedKey`.
