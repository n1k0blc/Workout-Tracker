/**
 * A persisted active-workout draft belongs to the account that created it (issue #127).
 * Every localStorage key that holds live-session state is namespaced by the owning
 * user id, so a second user on the same device never resumes the first user's session
 * and a forced logout can leave the draft alone to resume after re-login.
 */

const DRAFT_KEY = 'activeWorkoutDraft';
const META_KEY = 'activeWorkoutDraftMeta';
const WORKOUT_START_TIME_KEY = 'workoutStartTime';
const REST_START_TIME_KEY = 'restStartTime';
const REST_TIMER_TARGET_KEY = 'restTimerTarget';

/** Legacy timer key -> namespaced-keys property. */
const TIMER_KEYS: readonly [string, keyof DraftStorageKeys][] = [
  [WORKOUT_START_TIME_KEY, 'workoutStartTime'],
  [REST_START_TIME_KEY, 'restStartTime'],
  [REST_TIMER_TARGET_KEY, 'restTimerTarget'],
];

export interface DraftMeta {
  isPastWorkout: boolean;
  pastWorkoutDuration: number;
}

export interface DraftStorageKeys {
  draft: string;
  meta: string;
  workoutStartTime: string;
  restStartTime: string;
  restTimerTarget: string;
}

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * The localStorage keys holding one account's active session. A `null` user id
 * (auth not resolved yet) falls back to the bare keys -- only reachable before
 * anything writes a draft.
 */
export function draftStorageKeys(userId: string | null): DraftStorageKeys {
  const suffix = userId ? `::${userId}` : '';
  return {
    draft: DRAFT_KEY + suffix,
    meta: META_KEY + suffix,
    workoutStartTime: WORKOUT_START_TIME_KEY + suffix,
    restStartTime: REST_START_TIME_KEY + suffix,
    restTimerTarget: REST_TIMER_TARGET_KEY + suffix,
  };
}

/**
 * Resolve the draft for `userId`, adopting a pre-namespace draft once.
 *
 * One draft (and its timers) can span the deploy of this change under the bare
 * keys. The first account to restore afterwards claims it into its own namespace
 * -- the same way a draft persisted before workouts carried a `localDate` is
 * adopted today -- and the bare copy is dropped so a second account cannot also
 * pick it up.
 *
 * Returns the raw draft/meta JSON strings now at the namespaced location (or
 * `null` when there is nothing to restore); the caller parses and hydrates them.
 */
export function claimDraftForUser(
  storage: LocalStorageLike,
  userId: string,
): { draft: string | null; meta: string | null } {
  const keys = draftStorageKeys(userId);
  let draft = storage.getItem(keys.draft);
  let meta = storage.getItem(keys.meta);

  const legacyDraft = storage.getItem(DRAFT_KEY);
  const legacyMeta = storage.getItem(META_KEY);

  if ((!draft || !meta) && legacyDraft && legacyMeta) {
    storage.setItem(keys.draft, legacyDraft);
    storage.setItem(keys.meta, legacyMeta);
    for (const [legacyKey, prop] of TIMER_KEYS) {
      const value = storage.getItem(legacyKey);
      if (value !== null) storage.setItem(keys[prop], value);
    }
    draft = legacyDraft;
    meta = legacyMeta;
  }

  storage.removeItem(DRAFT_KEY);
  storage.removeItem(META_KEY);
  for (const [legacyKey] of TIMER_KEYS) storage.removeItem(legacyKey);

  return { draft, meta };
}
