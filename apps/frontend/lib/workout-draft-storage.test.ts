import { describe, it, expect } from 'vitest';
import {
  draftStorageKeys,
  claimDraftForUser,
  readSkippedSets,
  readAskAgainAt,
  forgottenOutcomeKey,
  forgottenClaimKey,
} from '@/lib/workout-draft-storage';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    snapshot: () => Object.fromEntries(map),
  };
}

describe('draftStorageKeys', () => {
  it('namespaces every session key by user id', () => {
    expect(draftStorageKeys('u1')).toEqual({
      draft: 'activeWorkoutDraft::u1',
      meta: 'activeWorkoutDraftMeta::u1',
      workoutStartTime: 'workoutStartTime::u1',
      restStartTime: 'restStartTime::u1',
      restTimerTarget: 'restTimerTarget::u1',
    });
  });

  it('falls back to bare keys before a user is known', () => {
    expect(draftStorageKeys(null).draft).toBe('activeWorkoutDraft');
  });
});

describe('claimDraftForUser', () => {
  it('restores a draft saved by the same account', () => {
    const store = fakeStorage({
      'activeWorkoutDraft::u1': '{"id":"local-1"}',
      'activeWorkoutDraftMeta::u1': '{"isPastWorkout":false,"pastWorkoutDuration":0}',
    });

    expect(claimDraftForUser(store, 'u1')).toEqual({
      draft: '{"id":"local-1"}',
      meta: '{"isPastWorkout":false,"pastWorkoutDuration":0}',
    });
  });

  it('does not restore another account\'s draft', () => {
    const store = fakeStorage({
      'activeWorkoutDraft::u1': '{"id":"local-1"}',
      'activeWorkoutDraftMeta::u1': '{"isPastWorkout":false,"pastWorkoutDuration":0}',
    });

    expect(claimDraftForUser(store, 'u2')).toEqual({ draft: null, meta: null });
  });

  it('adopts a pre-namespace draft, timers included, then drops the bare copy', () => {
    const store = fakeStorage({
      activeWorkoutDraft: '{"id":"legacy"}',
      activeWorkoutDraftMeta: '{"isPastWorkout":false,"pastWorkoutDuration":0}',
      workoutStartTime: '1700000000000',
      restStartTime: '1700000100000',
      restTimerTarget: '90',
    });

    const result = claimDraftForUser(store, 'u1');
    expect(result.draft).toBe('{"id":"legacy"}');

    const snap = store.snapshot();
    expect(snap['activeWorkoutDraft::u1']).toBe('{"id":"legacy"}');
    expect(snap['activeWorkoutDraftMeta::u1']).toBe('{"isPastWorkout":false,"pastWorkoutDuration":0}');
    expect(snap['workoutStartTime::u1']).toBe('1700000000000');
    expect(snap['restStartTime::u1']).toBe('1700000100000');
    expect(snap['restTimerTarget::u1']).toBe('90');
    expect(snap.activeWorkoutDraft).toBeUndefined();
    expect(snap.activeWorkoutDraftMeta).toBeUndefined();
    expect(snap.workoutStartTime).toBeUndefined();
  });

  it('adopts a legacy draft only once', () => {
    const store = fakeStorage({
      activeWorkoutDraft: '{"id":"legacy"}',
      activeWorkoutDraftMeta: '{"isPastWorkout":false,"pastWorkoutDuration":0}',
    });

    expect(claimDraftForUser(store, 'u1').draft).toBe('{"id":"legacy"}');
    expect(claimDraftForUser(store, 'u2')).toEqual({ draft: null, meta: null });
  });

  it('adopts the legacy draft when only a partial namespaced draft exists', () => {
    const store = fakeStorage({
      'activeWorkoutDraft::u1': '{"id":"half"}',
      activeWorkoutDraft: '{"id":"legacy"}',
      activeWorkoutDraftMeta: '{"isPastWorkout":true,"pastWorkoutDuration":42}',
    });

    const result = claimDraftForUser(store, 'u1');
    expect(result).toEqual({
      draft: '{"id":"legacy"}',
      meta: '{"isPastWorkout":true,"pastWorkoutDuration":42}',
    });
    expect(store.snapshot()['activeWorkoutDraft::u1']).toBe('{"id":"legacy"}');
  });

  it('returns nothing and leaves storage clean when there is no draft at all', () => {
    const store = fakeStorage();
    expect(claimDraftForUser(store, 'u1')).toEqual({ draft: null, meta: null });
    expect(store.snapshot()).toEqual({});
  });
});

describe('readAskAgainAt', () => {
  it('reads the re-ask time saved with the draft', () => {
    expect(readAskAgainAt({ askAgainAt: 1_700_000_000_000 })).toBe(1_700_000_000_000);
  });

  it('is null for a draft that was never snoozed, or holds something else', () => {
    expect(readAskAgainAt({})).toBeNull();
    expect(readAskAgainAt({ askAgainAt: 'soon' } as never)).toBeNull();
    expect(readAskAgainAt({ askAgainAt: Number.NaN })).toBeNull();
  });
});

describe('forgotten-workout keys', () => {
  it('namespaces the outcome notice and the single-run claim by account', () => {
    expect(forgottenOutcomeKey('u1')).toBe('forgottenWorkoutOutcome::u1');
    expect(forgottenOutcomeKey('u2')).not.toBe(forgottenOutcomeKey('u1'));
    expect(forgottenClaimKey('u1')).toBe('forgottenWorkoutClaim::u1');
  });
});

describe('readSkippedSets', () => {
  it('reads the swiped-away set numbers a draft was saved with', () => {
    expect(readSkippedSets({ skippedSets: { 'local-ex-1': [2, 3], 'local-ex-2': [1] } })).toEqual({
      'local-ex-1': [2, 3],
      'local-ex-2': [1],
    });
  });

  it('is empty for a draft saved before skip state was persisted', () => {
    expect(readSkippedSets({})).toEqual({});
  });

  it('keeps only well-formed entries of a damaged draft', () => {
    expect(
      readSkippedSets({
        skippedSets: { good: [1, 2], notAList: 'x', mixed: [1, 'a', -2, 1.5, 0, 3] },
      } as never),
    ).toEqual({ good: [1, 2], mixed: [1, 3] });
  });

  it('is empty when the field is not an object at all', () => {
    expect(readSkippedSets({ skippedSets: [1, 2] } as never)).toEqual({});
    expect(readSkippedSets({ skippedSets: null } as never)).toEqual({});
  });
});
