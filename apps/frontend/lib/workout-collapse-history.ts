export type CollapseHistoryEffect = 'push' | 'consume' | 'collapse' | 'none';

/**
 * The expanded workout keeps one extra "collapse-catcher" history entry so browser
 * / Android back collapses it rather than navigating the page behind it (issue
 * #132). This reconciles that entry with whether an expanded live workout is
 * currently on screen -- run it whenever that changes.
 *
 * @param hasEntry         whether we believe our entry is on the stack
 * @param expandedOnScreen a live session that is not minimized
 * @param markerOnStack    the current history entry already carries our marker --
 *                         true after a React remount or a reload landed on it, so
 *                         we adopt it instead of stacking a duplicate
 */
export function reconcileCollapseEntry(
  hasEntry: boolean,
  expandedOnScreen: boolean,
  markerOnStack: boolean,
): { hasEntry: boolean; effect: CollapseHistoryEffect } {
  if (expandedOnScreen && !hasEntry) {
    return { hasEntry: true, effect: markerOnStack ? 'none' : 'push' };
  }
  if (!expandedOnScreen && hasEntry) {
    return { hasEntry: false, effect: 'consume' };
  }
  return { hasEntry, effect: 'none' };
}

/**
 * A real back press fired (not one we triggered ourselves). If our entry was on
 * the stack the browser just popped it, so collapse the workout in place instead
 * of letting the hidden page navigate.
 */
export function handleBackPress(hasEntry: boolean): {
  hasEntry: boolean;
  effect: CollapseHistoryEffect;
} {
  return hasEntry
    ? { hasEntry: false, effect: 'collapse' }
    : { hasEntry: false, effect: 'none' };
}
