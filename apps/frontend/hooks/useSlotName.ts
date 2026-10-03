'use client';

import { useTranslations } from 'next-intl';

/**
 * The display name of an Abschnitt (#189, ADR-0008). While `seedKey` is set -- the default
 * four, untouched -- the name comes from the message catalogue in the active locale, so a
 * locale switch relabels them. A renamed Abschnitt has no `seedKey` and keeps what the user
 * typed. An unknown key falls back to the stored name rather than rendering a missing-message
 * placeholder.
 */
export function useSlotName() {
  const t = useTranslations('SlotNames');
  return (slot: { name: string; seedKey: string | null }): string =>
    slot.seedKey && t.has(slot.seedKey) ? t(slot.seedKey) : slot.name;
}
