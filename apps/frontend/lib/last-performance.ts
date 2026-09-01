import { LastPerformance, LastPerformanceSet, PlannedSet, SetType } from '@/types';

export interface PrefillResult {
  sets: PlannedSet[];
  /** History had a different total number of sets than the plan. */
  setCountMismatch: boolean;
  /** At least one slot actually took values from history. When false, history had nothing
   *  that fit the plan's structure and the caller should treat it like a never-performed
   *  exercise rather than claim an import that did not happen. */
  changed: boolean;
}

/**
 * Maps a `LastPerformance` response onto an exercise's planned sets (issue #112).
 *
 * **Structure comes from the target when the target has one; from history only when it
 * doesn't.** A swapped exercise keeps the plan's set count and set types -- that count is
 * programming the user chose -- and only its weight/reps/RIR/per-side values are replaced.
 * An added exercise and a free-workout exercise have no plan, so they take history's shape
 * wholesale.
 *
 * Within each set type, history maps positionally from the start: extras are dropped, and the
 * last available entry of that type is repeated for slots history cannot reach. A slot typed
 * WARMUP when history has no warm-up is left exactly as it was -- inventing a warm-up load is
 * guessing. `rest` is never touched: it stays whatever the plan slot carried. RIR is only
 * overwritten when history actually carries one -- a missing RIR is nothing to import, not a
 * reason to blank the plan's own target.
 *
 * `makeId` mints ids for the sets created in the no-structure case (the caller passes its own
 * local-id generator); the structured case keeps the target sets and their ids.
 */
export function mapLastPerformanceOntoPlan(
  target: readonly PlannedSet[] | null | undefined,
  history: readonly LastPerformanceSet[],
  makeId: () => string,
): PrefillResult {
  const hasStructure = !!target && target.length > 0;

  if (!hasStructure) {
    return {
      sets: history.map((h, i) => ({
        id: makeId(),
        order: i + 1,
        setType: h.setType,
        ...valuesFrom(h, 0),
        rest: 90,
      })),
      setCountMismatch: false,
      changed: history.length > 0,
    };
  }

  const byType = new Map<SetType, LastPerformanceSet[]>();
  for (const h of history) {
    const list = byType.get(h.setType);
    if (list) list.push(h);
    else byType.set(h.setType, [h]);
  }

  const cursor = new Map<SetType, number>();
  let changed = false;
  const sets = target.map((slot) => {
    const pool = byType.get(slot.setType);
    if (!pool || pool.length === 0) return slot; // untouched -- e.g. a warm-up slot, no warm-up history
    const idx = cursor.get(slot.setType) ?? 0;
    cursor.set(slot.setType, idx + 1);
    const h = pool[Math.min(idx, pool.length - 1)];
    changed = true;
    return { ...slot, ...valuesFrom(h, slot.rir) };
  });

  return { sets, setCountMismatch: history.length !== target.length, changed };
}

/** Structure kept, every exercise-specific value blanked -- for a never-performed swap, so the
 *  card shows empty fields instead of the swapped-out exercise's numbers (issue #112). */
export function blankPlanValues(target: readonly PlannedSet[]): PlannedSet[] {
  return target.map((slot) => ({
    id: slot.id,
    order: slot.order,
    setType: slot.setType,
    rest: slot.rest,
    reps: 0,
    weight: 0,
    rir: 0,
  }));
}

/** The exercise-specific values history contributes: weight, reps, RIR and per-side twins.
 *  Every per-side field is restated (as a value or `undefined`) so a swapped-out exercise's
 *  stale side data cannot survive on the new exercise's sets. `rirFallback` is used only when
 *  history carries no RIR -- the plan slot's own target in the structured case, 0 otherwise. */
function valuesFrom(
  h: LastPerformanceSet,
  rirFallback: number,
): Omit<PlannedSet, 'id' | 'order' | 'setType' | 'rest'> {
  return {
    reps: h.reps,
    weight: h.weight,
    rir: h.rir ?? rirFallback,
    repsLeft: h.repsLeft,
    repsRight: h.repsRight,
    weightLeft: h.weightLeft,
    weightRight: h.weightRight,
    rirLeft: h.rirLeft,
    rirRight: h.rirRight,
  };
}

const PREFILL_TOAST_DURATION_MS = 6000;
const PREFILL_TOAST_DURATION_LONG_MS = 10000;

/**
 * The one prefill toast (issue #112). It carries the whole story: the date and gym the values
 * came from, a note when the cascade degraded to another gym, and a hint when history had a
 * different number of sets than the plan. It runs longer for those last two cases, because the
 * set-count hint is the only actionable fact in it. `hadGymContext` is whether a gym was passed
 * to the lookup -- without one, landing on "any home gym" is not a degradation.
 */
export function buildPrefillToastMessage(
  result: LastPerformance,
  setCountMismatch: boolean,
  hadGymContext: boolean,
): { message: string; durationMs: number } {
  const [y, m, d] = result.performedOn.split('-');
  const date = `${d}.${m}.${y}`;
  const gym = result.gymName ?? 'Anderes Gym';

  let message = `Werte vom ${date} (${gym}) übernommen.`;
  const degraded = hadGymContext && result.source !== 'CURRENT_GYM';
  if (degraded) {
    message +=
      result.source === 'HOME_GYM'
        ? ' Kein Eintrag für dieses Gym – anderes Gym verwendet.'
        : ' Kein Gym-Eintrag – letztes Training verwendet.';
  }
  if (setCountMismatch) {
    message += ' Andere Satzanzahl als geplant – Sätze ggf. anpassen.';
  }

  return {
    message,
    durationMs: degraded || setCountMismatch ? PREFILL_TOAST_DURATION_LONG_MS : PREFILL_TOAST_DURATION_MS,
  };
}
