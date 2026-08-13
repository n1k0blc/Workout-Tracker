import { SetType } from '@/types';

/**
 * How an exercise card decides *which* sets to draw, and *what type* each one is.
 *
 * Extracted from exercise-card.tsx so both decisions are testable without a DOM: they
 * disagreed with each other for months and nobody could see it. The collapsed card draws
 * one bar per distinct set number while the expanded card draws one row per planned set,
 * so any two sets sharing a number silently collapse into a single bar -- and the row
 * lookup below then resolves both rows to the same set. That is exactly what a mixed
 * 0-/1-based `order` in the database produced (see migration
 * 20260814080000_normalize_order_to_one_based).
 *
 * These helpers only need set numbers to be *unique* within an exercise. Stored data was
 * made 1-based and contiguous by that migration, but nothing enforces it yet -- the input
 * DTOs validate `@Min(0)` and `replaceTree` persists whatever arrives, so save paths can
 * still write a 0-based or gappy tree. Enforcement is tracked separately; until it lands,
 * treat contiguity as a property of the data, not a guarantee.
 */

interface PlannedSetLike {
  order: number;
  setType?: SetType;
}

interface LoggedSetLike {
  setNumber: number;
  setType?: SetType;
}

/**
 * The set numbers the collapsed card draws a progress bar for: planned sets the user
 * hasn't skipped this session, plus anything actually logged, plus unlogged extras.
 *
 * De-duplicating is deliberate -- a logged planned set must not draw a second bar -- which
 * is why the count is only trustworthy while set numbers are unique.
 */
export function getSetIndicatorSlots(input: {
  plannedSets?: PlannedSetLike[];
  sets: LoggedSetLike[];
  additionalSetNumbers?: number[];
  skippedSetNumbers?: Set<number>;
}): number[] {
  const skipped = input.skippedSetNumbers ?? new Set<number>();
  const slots = new Set<number>();

  (input.plannedSets ?? [])
    .filter((ps) => !skipped.has(ps.order))
    .forEach((ps) => slots.add(ps.order));

  input.sets.forEach((s) => slots.add(s.setNumber));
  (input.additionalSetNumbers ?? []).forEach((n) => slots.add(n));

  return Array.from(slots).sort((a, b) => a - b);
}

/**
 * The planned rows the expanded card draws, each resolved to the warm-up/working type it
 * renders with: a logged set wins over the plan, because logging is what actually happened.
 *
 * Transient per-field edits (the card's local `editValues`) are layered on top by the
 * caller and deliberately not modelled here -- this is the type a row renders with before
 * the user touches it.
 */
export function resolveSetRows(input: {
  plannedSets?: PlannedSetLike[];
  sets: LoggedSetLike[];
  skippedSetNumbers?: Set<number>;
}): { setNumber: number; setType: SetType }[] {
  const skipped = input.skippedSetNumbers ?? new Set<number>();

  return (input.plannedSets ?? [])
    .filter((ps) => !skipped.has(ps.order))
    .map((ps) => {
      const logged = input.sets.find((s) => s.setNumber === ps.order);
      return {
        setNumber: ps.order,
        setType: logged?.setType ?? ps.setType ?? SetType.WORKING,
      };
    });
}
