import { PlannedSet, SetType } from '@/types';
import { aggregateSetSides } from './set-sides';

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

/**
 * The RIR a plan row carries between storage, the editor and the save payload (#227): none on a
 * warm-up, which has no RIR and which the server rejects one on, and a working set's missing RIR
 * stays missing instead of becoming 0 ("to failure"). The editors then ask for it.
 */
export function planRir(s: { setType?: SetType; rir?: number | null }): number | undefined {
  return (s.setType ?? SetType.WORKING) === SetType.WARMUP ? undefined : (s.rir ?? undefined);
}

const renumber = (sets: PlannedSet[]): PlannedSet[] =>
  sets.map((set, index) => ({ ...set, order: index + 1 }));

/**
 * Appends a set, seeded from the previous one so adding a third set to a 3x10@60 exercise
 * doesn't hand the user a blank row to retype.
 *
 * For a unilateral exercise (`opts.isUnilateral`) the new set carries per-side targets too,
 * seeded from the previous set's sides -- so adding a set to a plan that was overwritten
 * asymmetrically keeps both sides rather than collapsing to the aggregate (issue #103). The
 * aggregate is then re-derived from those sides so the row stays internally consistent.
 */
export function addPlannedSet(
  sets: PlannedSet[],
  opts: { isUnilateral?: boolean } = {},
): PlannedSet[] {
  const previous = sets[sets.length - 1];

  // No-previous fallback is 0 reps / 0 kg / 0 RIR (rest still 90) so a brand-new exercise
  // behaves the same here as it does in the active workout (issue #111): obvious 0
  // placeholders to type an estimate into, not a fabricated 10x0@2.
  const reps = previous?.reps ?? 0;
  const weight = previous?.weight ?? 0;
  // RIR is the exception (#227): a previous warm-up has none to copy, and a previous working
  // set that has none yet must not become RIR 0 ("to failure") unasked. The new set then shows
  // an empty RIR as an error until the user enters one.
  const inheritsRir = previous !== undefined && previous.setType !== SetType.WARMUP;
  const rir = previous === undefined ? 0 : inheritsRir ? (previous.rir ?? undefined) : undefined;

  const next: PlannedSet = {
    id: `planned-${Date.now()}-${sets.length}`,
    // From the highest existing number, not the array length: if the list ever arrives with
    // a gap, length + 1 would collide with a set that is already there, and duplicate numbers
    // are silently destructive downstream -- the collapsed card drops a bar and a single edit
    // patches both rows (see set-slots.ts).
    order: Math.max(0, ...sets.map((s) => s.order)) + 1,
    setType: SetType.WORKING,
    reps,
    weight,
    rir,
    rest: previous?.rest ?? DEFAULT_REST_SECONDS,
  };

  if (opts.isUnilateral) {
    const repsLeft = previous?.repsLeft ?? reps;
    const repsRight = previous?.repsRight ?? reps;
    const weightLeft = previous?.weightLeft ?? weight;
    const weightRight = previous?.weightRight ?? weight;
    const rirLeft = inheritsRir ? (previous.rirLeft ?? rir) : rir;
    const rirRight = inheritsRir ? (previous.rirRight ?? rir) : rir;
    const agg = aggregateSetSides(
      { reps: repsLeft, weight: weightLeft, rir: rirLeft },
      { reps: repsRight, weight: weightRight, rir: rirRight },
    );
    Object.assign(next, {
      repsLeft,
      repsRight,
      weightLeft,
      weightRight,
      rirLeft,
      rirRight,
      reps: agg.reps,
      weight: agg.weight,
      rir: agg.rir ?? rir,
    });
  }

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
  data: Partial<
    Pick<
      PlannedSet,
      | 'reps'
      | 'weight'
      | 'rir'
      | 'rest'
      | 'setType'
      | 'repsLeft'
      | 'repsRight'
      | 'weightLeft'
      | 'weightRight'
      | 'rirLeft'
      | 'rirRight'
    >
  >,
): PlannedSet[] {
  return sets.map((set) => (set.order === setNumber ? { ...set, ...data } : set));
}
