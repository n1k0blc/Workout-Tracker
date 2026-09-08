'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Alle / Favoriten / Zuletzt line tabs and their placeholder copy, shared by the logging
 * picker (`food-picker-sheet`) and the Mahlzeit editor's Zutat search (`meal-editor-sheet`)
 * so the two surfaces cannot drift (#148).
 */
export const PICKER_TABS = [
  { id: 'alle', label: 'Alle' },
  { id: 'favoriten', label: 'Favoriten' },
  { id: 'zuletzt', label: 'Zuletzt' },
] as const;
export type PickerTabId = (typeof PICKER_TABS)[number]['id'];

/** Empty-state copy for the two derived tabs. */
export const FAVORITEN_EMPTY = 'Noch keine Favoriten. Tippe den Stern an einer Zeile an.';
export const ZULETZT_EMPTY = 'Noch nichts protokolliert.';
export const PICKER_LOADING = 'Lädt …';

export function PickerTabBar({
  tab,
  onTab,
}: {
  tab: PickerTabId;
  onTab: (t: PickerTabId) => void;
}) {
  return (
    <div className="flex gap-1 border-b">
      {PICKER_TABS.map((t) => (
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
