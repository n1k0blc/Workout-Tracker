import { describe, it, expect } from 'vitest';
import { reconcileCollapseEntry, handleBackPress } from '@/lib/workout-collapse-history';

describe('reconcileCollapseEntry', () => {
  it('pushes an entry when an expanded workout appears and we hold none', () => {
    expect(reconcileCollapseEntry(false, true, false)).toEqual({ hasEntry: true, effect: 'push' });
  });

  it('adopts an existing marker entry instead of stacking a duplicate', () => {
    expect(reconcileCollapseEntry(false, true, true)).toEqual({ hasEntry: true, effect: 'none' });
  });

  it('consumes the entry when the expanded workout leaves the screen', () => {
    expect(reconcileCollapseEntry(true, false, true)).toEqual({ hasEntry: false, effect: 'consume' });
  });

  it('does nothing when the entry already matches the screen state', () => {
    expect(reconcileCollapseEntry(true, true, true)).toEqual({ hasEntry: true, effect: 'none' });
    expect(reconcileCollapseEntry(false, false, false)).toEqual({ hasEntry: false, effect: 'none' });
  });
});

describe('handleBackPress', () => {
  it('collapses the workout when our entry was on the stack', () => {
    expect(handleBackPress(true)).toEqual({ hasEntry: false, effect: 'collapse' });
  });

  it('passes the back press through when we hold no entry', () => {
    expect(handleBackPress(false)).toEqual({ hasEntry: false, effect: 'none' });
  });
});

/**
 * Walk a sequence of user actions through both functions the way the overlay
 * wires them, asserting the entry count never drifts outside {0, 1} and that
 * back only navigates when the workout is not covering the screen.
 */
function simulate(events: Array<'start' | 'expand' | 'minimize' | 'end' | 'back'>) {
  let hasEntry = false;
  let markerOnStack = false;
  let live = false;
  let minimized = false;
  const effects: string[] = [];

  for (const event of events) {
    if (event === 'back') {
      const r = handleBackPress(hasEntry);
      hasEntry = r.hasEntry;
      markerOnStack = false; // the browser popped it
      if (r.effect === 'collapse') minimized = true;
      effects.push(`back:${r.effect}`);
      continue;
    }

    if (event === 'start') {
      live = true;
      minimized = false;
    } else if (event === 'expand') {
      minimized = false;
    } else if (event === 'minimize') {
      minimized = true;
    } else if (event === 'end') {
      live = false;
      minimized = false;
    }

    const r = reconcileCollapseEntry(hasEntry, live && !minimized, markerOnStack);
    hasEntry = r.hasEntry;
    if (r.effect === 'push') markerOnStack = true;
    if (r.effect === 'consume') markerOnStack = false;
    effects.push(`${event}:${r.effect}`);
  }

  return { hasEntry, markerOnStack, minimized, effects };
}

describe('collapse-history sequences', () => {
  it('arms an entry once a workout is running and expanded', () => {
    expect(simulate(['start'])).toMatchObject({ hasEntry: true, markerOnStack: true });
  });

  it('back collapses an expanded workout without a stray entry left behind', () => {
    const r = simulate(['start', 'minimize', 'expand', 'back']);
    expect(r.minimized).toBe(true);
    expect(r.hasEntry).toBe(false);
    expect(r.markerOnStack).toBe(false);
    expect(r.effects.at(-1)).toBe('back:collapse');
  });

  it('back after minimizing navigates normally and does not re-expand', () => {
    const r = simulate(['start', 'minimize', 'back']);
    expect(r.effects.at(-1)).toBe('back:none');
    expect(r.minimized).toBe(true);
  });

  it('repeated expand/minimize cycles never stack more than one entry', () => {
    const r = simulate([
      'start',
      'minimize', 'expand',
      'minimize', 'expand',
      'minimize', 'expand',
    ]);
    expect(r.hasEntry).toBe(true);
    const pushes = r.effects.filter((e) => e.endsWith(':push')).length;
    const consumes = r.effects.filter((e) => e.endsWith(':consume')).length;
    expect(pushes - consumes).toBe(1); // exactly the one currently held
  });

  it('ending the session consumes the entry', () => {
    const r = simulate(['start', 'end']);
    expect(r.hasEntry).toBe(false);
    expect(r.effects.at(-1)).toBe('end:consume');
  });
});
