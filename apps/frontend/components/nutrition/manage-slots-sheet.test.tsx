// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';

const api = vi.hoisted(() => ({
  getMealSlots: vi.fn(),
  createMealSlot: vi.fn(),
  renameMealSlot: vi.fn(),
  reorderMealSlots: vi.fn(),
  setMealSlotArchived: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ apiClient: api }));
const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/hooks/useSlotName', () => ({ useSlotName: () => (slot: { name: string }) => slot.name }));

import { ManageSlotsSheet } from './manage-slots-sheet';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const slots = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Abschnitt ${i}`, seedKey: null, order: i + 1, archived: false }));

/** Abschnitt names are 1-60 characters and a user has at most 10 active ones (#230). */
async function renderSheet(active = slots(2)) {
  api.getMealSlots.mockResolvedValue({ active, archived: [] });
  api.createMealSlot.mockResolvedValue({});
  api.renameMealSlot.mockResolvedValue({});
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <ManageSlotsSheet open onOpenChange={() => {}} onChanged={() => {}} />
    </NextIntlClientProvider>,
  );
  await screen.findByText(active[0].name);
}
const newName = () => screen.getByPlaceholderText(deMessages.ManageSlotsSheet.newSlotPlaceholder) as HTMLInputElement;
const add = () => fireEvent.click(screen.getByRole('button', { name: deMessages.ManageSlotsSheet.add }));

describe('new Abschnitt', () => {
  it('is added at 60 characters', async () => {
    await renderSheet();
    fireEvent.change(newName(), { target: { value: 'a'.repeat(60) } });
    add();
    await waitFor(() => expect(api.createMealSlot).toHaveBeenCalledWith('a'.repeat(60)));
  });

  it.each([
    ['a'.repeat(61), 'Der Name darf höchstens 60 Zeichen lang sein.'],
    ['   ', 'Bitte gib einen Namen ein.'],
  ])('refuses %j under the field', async (value, message) => {
    await renderSheet();
    fireEvent.change(newName(), { target: { value } });
    add();
    expect(screen.getByText(message)).toBeTruthy();
    expect(newName().getAttribute('aria-invalid')).toBe('true');
    expect(api.createMealSlot).not.toHaveBeenCalled();
  });

  it('refuses an eleventh active Abschnitt, after ten', async () => {
    await renderSheet(slots(10));
    fireEvent.change(newName(), { target: { value: 'Elf' } });
    add();
    expect(screen.getByText('Du kannst höchstens 10 aktive Abschnitte haben.')).toBeTruthy();
    expect(api.createMealSlot).not.toHaveBeenCalled();
  });

  it('adds a tenth', async () => {
    await renderSheet(slots(9));
    fireEvent.change(newName(), { target: { value: 'Zehn' } });
    add();
    await waitFor(() => expect(api.createMealSlot).toHaveBeenCalledWith('Zehn'));
  });
});

describe('renaming an Abschnitt', () => {
  async function startRename() {
    await renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Abschnitt 0 umbenennen' }));
    return screen.getByDisplayValue('Abschnitt 0') as HTMLInputElement;
  }

  it('saves 60 characters', async () => {
    const field = await startRename();
    fireEvent.change(field, { target: { value: 'r'.repeat(60) } });
    fireEvent.click(screen.getByRole('button', { name: deMessages.ManageSlotsSheet.save }));
    await waitFor(() => expect(api.renameMealSlot).toHaveBeenCalledWith('s0', 'r'.repeat(60)));
  });

  it.each([
    ['r'.repeat(61), 'Der Name darf höchstens 60 Zeichen lang sein.'],
    ['  ', 'Bitte gib einen Namen ein.'],
  ])('refuses %j under the field', async (value, message) => {
    const field = await startRename();
    fireEvent.change(field, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: deMessages.ManageSlotsSheet.save }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(api.renameMealSlot).not.toHaveBeenCalled();
  });
});
