import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { LastPerformance, PlannedSet } from '@/types';
import { resolvePlanPrefill } from '@/lib/last-performance';

interface PlanEntry {
  id: string;
  exerciseId: string;
}

interface UsePlanExercisePrefillOptions<T extends PlanEntry> {
  /** The editor's current exercise list. The hook keeps a ref to it so the lookup, which
   *  resolves after the swap/add has already applied, reads state fresher than its closure. */
  exercises: T[];
  /** The field the editor keeps its planned sets under: `'plannedSets'` for the template and
   *  blueprint editors (ExerciseLog shape), `'sets'` for the cycle day editor (WorkoutExercise). */
  setsKey: keyof T & string;
  /** The asking context's gym -- a template's `recommendedGymId`, a cycle day's
   *  `plannedHomeGymId` -- or `undefined` for the standalone template editor, which has no gym
   *  picker and so starts the cascade at "any home gym". */
  gymId: string | undefined;
  /** Mints local ids for the sets created when history's shape is taken wholesale (add). */
  makeSetId: () => string;
  /** Writes the prefilled list back. The hook hands over the whole next list rather than one
   *  entry so callers that mirror their state elsewhere (the blueprint step syncs to the wizard
   *  form) can do both in one call. */
  onApply: (next: T[]) => void;
}

/**
 * Fills a just-swapped or just-added exercise's planned sets from the last time it was actually
 * performed, for the plan editors (issue #113 -- the active workout has its own copy in
 * `workout-context.tsx`).
 *
 * Returns a `prefill(exerciseLogId, exerciseId, isSwap)` to call *after* the swap/add has
 * applied from local state -- it never blocks that. The lookup runs, then:
 *
 *  - the entry is re-read from the ref; if the user swapped again or removed the card while the
 *    request was in flight, nothing happens;
 *  - `resolvePlanPrefill` decides the sets (plan structure wins on swap, history's shape wins
 *    on add) and the toast;
 *  - a failed request returns silently and leaves the fields exactly as they were.
 */
export function usePlanExercisePrefill<T extends PlanEntry>({
  exercises,
  setsKey,
  gymId,
  makeSetId,
  onApply,
}: UsePlanExercisePrefillOptions<T>) {
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  const onApplyRef = useRef(onApply);
  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);

  return useCallback(
    async (exerciseLogId: string, exerciseId: string, isSwap: boolean) => {
      let result: LastPerformance | null;
      try {
        result = await apiClient.getExerciseLastPerformance({ exerciseId, gymId });
      } catch {
        return;
      }

      const list = exercisesRef.current;
      const entry = list.find((e) => e.id === exerciseLogId);
      // The user may have swapped again or removed the card while the request was in flight.
      if (!entry || entry.exerciseId !== exerciseId) return;

      const currentSets = ((entry[setsKey] as unknown as PlannedSet[]) ?? []) as readonly PlannedSet[];
      const decision = resolvePlanPrefill(currentSets, result, isSwap, gymId !== undefined, makeSetId);
      if (!decision) return;

      const next = list.map((e) =>
        e.id === exerciseLogId ? ({ ...e, [setsKey]: decision.sets } as T) : e,
      );
      onApplyRef.current(next);

      if (decision.toast) {
        toast.info(decision.toast.message, { duration: decision.toast.durationMs });
      }
    },
    [setsKey, gymId, makeSetId],
  );
}
