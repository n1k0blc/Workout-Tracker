# 7. SEED foods are translated; barcode lookup stays global and text search ranks by market

Date: 2026-10-03

## Status

Accepted

## Context

The Lebensmittel library mixes three kinds of rows (#188): 289 curated `SEED` staples, ~180k
`OPEN_FOOD_FACTS` imports and `USER` foods. Only the first kind is *untranslated* in the sense
ADR-0006 handles. The imports are market-filtered German products — German already is their
language — and `USER` foods are user content. Two related questions needed an answer before
more markets are added, because they would otherwise be settled accidentally by whoever adds
the second market:

- Should the product's market limit what a **barcode scan** can identify?
- Should the user's market limit what **text search** returns?

## Decision

**SEED foods and their Portionsgrößen are translated the way Übungen are (ADR-0006).**
`FoodTranslation(foodId, locale, name)` and `FoodPortionTranslation(portionId, locale, label)`,
each unique per parent and locale, with a cascading foreign key. The API resolves names from
`X-Locale` (`@ClientLocale()`), so DTO shapes are unchanged. Fallback is requested locale →
default locale → any row → the base column, never empty, and every fallback is logged. The seed
fails unless every SEED food and portion has `de` and `en` (`FoodsSeed-en.csv`).
`OPEN_FOOD_FACTS` and `USER` foods render verbatim regardless of stray rows.

- Search matches **any** translation of a SEED food, so an English user typing "apple" finds
  Apfel. Source grouping (own `USER`, then `SEED`, then everything else — ADR-0003) is
  unchanged; the SEED group is ordered by the *resolved* name in memory, which is safe because
  it is ~289 rows and is fetched uncapped. The own and rest groups keep their capped SQL order.
- The seed rewrites a food's portions wholesale, so portion translation rows are re-created on
  every seed run; the cascade means none can be orphaned.

**Barcode lookup stays global.** It queries the world Open Food Facts endpoint, and refusing to
identify a physical product because of a market preference would be absurd: the user is holding
it.

**Text search ranks by market; it does not filter by it.** When further markets exist, a
market's products sort ahead of others, but every product stays reachable. Hard filtering
creates dead ends for imported goods and for expats, who are the most likely non-German users.

## Consequences

Every read path that returns a food name or portion label must load the translation rows and go
through `resolveFoodName` / `resolvePortionLabel` (`common/utils/food-name.util.ts`): foods,
meals (ingredient names, portions) and the picker today. Diary entries are snapshots (ADR-0002)
and keep the name they were logged with.

**Exit condition.** Ordering the SEED group in memory stops being adequate if the curated set
grows by orders of magnitude, or if imports are ever translated; revisit the read path then
rather than patching it. Market ranking is a decision, not an implementation — no market column
exists yet.
