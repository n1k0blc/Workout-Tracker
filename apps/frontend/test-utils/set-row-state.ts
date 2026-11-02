import { useState } from 'react';
import { EMPTY_SET_ROW_STATE, type SetRowState } from '@/lib/workout-completeness';

/**
 * The set-row slice of `useWorkout()` (#228) for tests that mock the workout context and render
 * a single exercise card: swiped-away planned sets and added rows, kept in the card's own React
 * state so a swipe still re-renders it. Used only from tests, in the mock's `useWorkout`.
 */
export function useFakeSetRowState() {
  const [setRowState, setSetRowState] = useState<SetRowState>(EMPTY_SET_ROW_STATE);
  const add = (map: SetRowState['skipped'], id: string, n: number) =>
    map[id]?.includes(n) ? map : { ...map, [id]: [...(map[id] ?? []), n].sort((a, b) => a - b) };
  const remove = (map: SetRowState['skipped'], id: string, n: number) => ({
    ...map,
    [id]: (map[id] ?? []).filter((x) => x !== n),
  });
  return {
    setRowState,
    skipPlannedSet: (id: string, n: number) =>
      setSetRowState((s) => ({ skipped: add(s.skipped, id, n), added: remove(s.added, id, n) })),
    addSetRow: (id: string, n: number) => setSetRowState((s) => ({ ...s, added: add(s.added, id, n) })),
    removeSetRow: (id: string, n: number) => setSetRowState((s) => ({ ...s, added: remove(s.added, id, n) })),
  };
}
