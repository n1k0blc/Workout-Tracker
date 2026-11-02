// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import { ApiError } from '@/lib/api/errors';

const { createDiaryEntry } = vi.hoisted(() => ({ createDiaryEntry: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiClient: { createDiaryEntry } }));
const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/hooks/useSlotName', () => ({ useSlotName: () => (slot: { name: string }) => slot.name }));

import { QuickEntrySheet } from './quick-entry-sheet';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * The Schnelleintrag (#230): name up to 120, kcal 0-10000, macros 0-1000 g, and, when it is also
 * saved as a Lebensmittel, the tighter Lebensmittel limits (900 kcal, 100 g a macro, 100 g in all).
 */
function renderSheet() {
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <QuickEntrySheet
        open
        onOpenChange={() => {}}
        slots={[{ id: 's1', name: 'Frühstück', seedKey: null }]}
        defaultSlotId="s1"
        date="2026-11-02"
        onCreated={() => {}}
      />
    </NextIntlClientProvider>,
  );
}
// The field names used below, as the German labels spell them.
const LABELS: Record<string, string> = { Name: 'Bezeichnung', Kohlenhydrate: 'Kohlenh' };
const field = (name: string) => screen.getByLabelText(new RegExp(`^${LABELS[name] ?? name}`));
function fill(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(field(name), { target: { value } });
  }
}
const ok = { Name: 'Gemüsepfanne', Kalorien: '540', Kohlenhydrate: '48', Protein: '22', Fett: '24' };
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
const sent = () => waitFor(() => expect(createDiaryEntry).toHaveBeenCalledTimes(1));

describe('Schnelleintrag limits', () => {
  it('takes the last valid value of every field', async () => {
    createDiaryEntry.mockResolvedValue({});
    renderSheet();
    fill({ Name: 'n'.repeat(120), Kalorien: '10000', Kohlenhydrate: '1000', Protein: '1000', Fett: '1000' });
    save();
    await sent();
  });

  it.each([
    ['Name', 'n'.repeat(121), 'Der Name darf höchstens 120 Zeichen lang sein.'],
    ['Name', '  ', 'Bitte gib einen Namen ein.'],
    ['Kalorien', '10001', 'Die Kalorien dürfen höchstens 10.000 kcal betragen.'],
    ['Kalorien', '', 'Bitte gib die Kalorien ein.'],
    ['Kalorien', '-1', 'Die Kalorien dürfen nicht negativ sein.'],
    ['Kohlenhydrate', '1001', 'Die Kohlenhydrate dürfen höchstens 1.000 g betragen.'],
    ['Protein', '1001', 'Das Protein darf höchstens 1.000 g betragen.'],
    ['Fett', '1001', 'Das Fett darf höchstens 1.000 g betragen.'],
  ])('refuses %s = %j under the field', (label, value, message) => {
    renderSheet();
    fill({ ...ok, [label]: value });
    save();
    expect(screen.getByText(message)).toBeTruthy();
    expect(field(label).getAttribute('aria-invalid')).toBe('true');
    expect(createDiaryEntry).not.toHaveBeenCalled();
  });

  it('treats a blank macro as 0', async () => {
    createDiaryEntry.mockResolvedValue({});
    renderSheet();
    fill({ ...ok, Protein: '' });
    save();
    await sent();
    expect(createDiaryEntry).toHaveBeenCalledWith(expect.objectContaining({ protein: 0 }));
  });
});

describe('Schnelleintrag saved as Lebensmittel', () => {
  const saveAsFood = () => fireEvent.click(screen.getByRole('checkbox'));

  it('is saved at exactly the Lebensmittel limits', async () => {
    createDiaryEntry.mockResolvedValue({});
    renderSheet();
    fill({ ...ok, Kalorien: '900', Kohlenhydrate: '40', Protein: '30', Fett: '30' });
    saveAsFood();
    save();
    await sent();
    expect(createDiaryEntry).toHaveBeenCalledWith(expect.objectContaining({ saveAsFood: true }));
  });

  it.each([
    ['Kalorien', '900,1'],
    ['Kalorien', '540,55'],
    ['Kohlenhydrate', '100,1'],
    ['Fett', '30,1'],
  ])('is refused with %s = %s, with the reason under the checkbox', (label, value) => {
    renderSheet();
    fill({ ...ok, Kohlenhydrate: '40', Protein: '30', Fett: '30', Kalorien: '900' });
    fill({ [label]: value });
    saveAsFood();
    save();
    expect(
      screen.getByText(/Als Lebensmittel lässt sich das nur speichern, wenn die Werte zu 100 g passen/),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
    expect(createDiaryEntry).not.toHaveBeenCalled();
  });

  it('logs the same large values when it is not saved as a Lebensmittel', async () => {
    createDiaryEntry.mockResolvedValue({});
    renderSheet();
    fill({ ...ok, Kalorien: '2400', Kohlenhydrate: '300', Protein: '120', Fett: '80' });
    save();
    await sent();
  });

  it('shows the server refusing it under the checkbox too', async () => {
    createDiaryEntry.mockRejectedValue(new ApiError(400, 'QUICK_ENTRY_NOT_A_FOOD'));
    renderSheet();
    fill(ok);
    saveAsFood();
    save();
    expect(await screen.findByText(/Als Lebensmittel lässt sich das nur speichern/)).toBeTruthy();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
