import { PlannedSet, SetType } from '@/types';

/**
 * Structural edits to an exercise's planned sets, for the editors that own a plan rather
 * than a performed session (template editor; blueprint editors eventually).
 *
 * `plannedSets` is the single representation those screens edit. The template editor used to
 * keep a second, fabricated `sets` list -- a "logged" copy of every planned set, stamped with
 * a completion timestamp for data that was never performed -- because the shared ExerciseCard
 * commits edits by logging. Two lists reconciled by set number is how a set's warm-up/working
 * type ended up rendering from the wrong row, and how value edits reached one list but were
 * saved from the other.
 *
 * `order` is 1-based and contiguous; every operation here preserves that, because the card's
 * bar/row derivation requires unique numbers (see set-slots.ts) and the API rejects gaps
 * (see the backend's WorkoutTreeService).
 */

const DEFAULT_REST_SECONDS = 90;

const renumber = (sets: PlannedSet[]): PlannedSet[] =>
  sets.map((set, index) => ({ ...set, order: index + 1 }));

/**
 * Appends a set, seeded from the previous one so adding a third set to a 3x10@60 exercise
 * doesn't hand the user a blank row to retype.
 */
export function addPlannedSet(sets: PlannedSet[]): PlannedSet[] {
  const previous = sets[sets.length - 1];

  const next: PlannedSet = {
    id: `planned-${Date.now()}-${sets.length}`,
    // From the highest existing number, not the array length: if the list ever arrives with
    // a gap, length + 1 would collide with a set that is already there, and duplicate numbers
    // are silently destructive downstream -- the collapsed card drops a bar and a single edit
    // patches both rows (see set-slots.ts).
    order: Math.max(0, ...sets.map((s) => s.order)) + 1,
    setType: SetType.WORKING,
    reps: previous?.reps ?? 10,
    weight: previous?.weight ?? 0,
    rir: previous?.rir ?? 2,
    rest: previous?.rest ?? DEFAULT_REST_SECONDS,
  };

  return [...sets, next];
}

/** Removes a set and closes the gap it leaves. */
export function removePlannedSet(sets: PlannedSet[], setNumber: number): PlannedSet[] {
  return renumber(sets.filter((set) => set.order !== setNumber));
}

/** Patches one set's values in place; numbering is untouched. */
export function updatePlannedSet(
  sets: PlannedSet[],
  setNumber: number,
  data: Partial<Pick<PlannedSet, 'reps' | 'weight' | 'rir' | 'rest' | 'setType'>>,
): PlannedSet[] {
  return sets.map((set) => (set.order === setNumber ? { ...set, ...data } : set));
}
