'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The picker's line tabs and their placeholder copy, shared by the logging picker
 * (`food-picker-sheet`) and the Mahlzeit editor's Zutat search (`meal-editor-screen`) so the
 * two surfaces cannot drift (#148).
 *
 * The tab set is a parameter, not a constant: the logging picker splits its long list into
 * separate Lebensmittel and Mahlzeiten tabs, while the Zutat search has no Mahlzeiten tab --
 * a Mahlzeit cannot be an ingredient of another one (#155).
 */
export const LOGGING_PICKER_TABS = [
  { id: 'lebensmittel', label: 'Lebensmittel' },
  { id: 'mahlzeiten', label: 'Mahlzeiten' },
  { id: 'favoriten', label: 'Favoriten' },
  { id: 'zuletzt', label: 'Zuletzt' },
] as const;

export const ZUTAT_PICKER_TABS = [
  { id: 'lebensmittel', label: 'Lebensmittel' },
  { id: 'favoriten', label: 'Favoriten' },
  { id: 'zuletzt', label: 'Zuletzt' },
] as const;

export type PickerTabId = (typeof LOGGING_PICKER_TABS)[number]['id'];
export type PickerTab = { id: PickerTabId; label: string };

/** Empty-state copy for the two derived tabs. */
export const FAVORITEN_EMPTY = 'Noch keine Favoriten. Tippe den Stern an einer Zeile an.';
export const ZULETZT_EMPTY = 'Noch nichts protokolliert.';
export const PICKER_LOADING = 'Lädt …';

export function PickerTabBar({
  tab,
  onTab,
  tabs,
}: {
  tab: PickerTabId;
  onTab: (t: PickerTabId) => void;
  tabs: readonly PickerTab[];
}) {
  return (
    <div className="flex gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTab(t.id)}
          className={cn(
            'relative px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em]',
            tab === t.id ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {t.label}
          {tab === t.id && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}

/** The centered muted line a tab shows while loading or when it has nothing to list. */
export function PickerTabPlaceholder({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
