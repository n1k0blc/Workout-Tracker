// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import { ApiError } from '@/lib/api/errors';

const { createFood } = vi.hoisted(() => ({ createFood: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiClient: { createFood, updateFood: vi.fn(), deleteFood: vi.fn(), getSimilarFoods: vi.fn().mockResolvedValue([]) },
}));
const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/components/nutrition/barcode-capture', () => ({ BarcodeCapture: () => null }));

import { FoodEditorDialog } from './food-editor-dialog';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * The Lebensmittel editor (#230): name up to 120, kcal 0-900 with one decimal, macros 0-100 each
 * and 100 together, an EAN with a valid check digit, Portionsgroessen of 0.1-5000 and a label of
 * up to 60 characters. Every limit at its last valid and first invalid value.
 */
function renderEditor() {
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <FoodEditorDialog open onOpenChange={() => {}} onChanged={() => {}} />
    </NextIntlClientProvider>,
  );
  fill({ Name: 'Haferflocken' });
}
function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label === 'EAN' ? /^EAN/ : label), { target: { value } });
  }
}
const valid = { Kalorien: '372', Kohlenhydrate: '60', Protein: '13', Fett: '7' };
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
const saved = () => waitFor(() => expect(createFood).toHaveBeenCalledTimes(1));

describe('Lebensmittel name', () => {
  it('saves 120 characters and refuses 121', async () => {
    createFood.mockResolvedValue({ id: 'f' });
    renderEditor();
    fill({ ...valid, Name: 'n'.repeat(121) });
    save();
    expect(screen.getByText('Der Name darf höchstens 120 Zeichen lang sein.')).toBeTruthy();
    expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('true');
    expect(createFood).not.toHaveBeenCalled();

    fill({ Name: 'n'.repeat(120) });
    save();
    await saved();
  });
});

describe('Lebensmittel nutrients', () => {
  it.each([
    ['Kalorien', '900', '900,1', 'Die Kalorien dürfen höchstens 900 kcal betragen.'],
    ['Kohlenhydrate', '100', '100,1', 'Die Kohlenhydrate dürfen höchstens 100 g betragen.'],
    ['Protein', '100', '100,1', 'Das Protein darf höchstens 100 g betragen.'],
    ['Fett', '100', '100,1', 'Das Fett darf höchstens 100 g betragen.'],
  ])('%s: %s passes and %s does not', async (label, last, first, message) => {
    createFood.mockResolvedValue({ id: 'f' });
    renderEditor();
    // Alone at its limit the other macros are zero, so the sum rule is not in play.
    const zero = { Kalorien: '0', Kohlenhydrate: '0', Protein: '0', Fett: '0' };
    fill({ ...zero, [label]: first });
    save();
    expect(screen.getByText(message)).toBeTruthy();
    expect(createFood).not.toHaveBeenCalled();

    fill({ [label]: last });
    save();
    await saved();
  });

  it('refuses a negative value and a second kcal decimal', () => {
    renderEditor();
    fill({ ...valid, Kalorien: '371,55', Protein: '-1' });
    save();
    expect(screen.getByText('Verwende höchstens eine Nachkommastelle.')).toBeTruthy();
    expect(screen.getByText('Das Protein darf nicht negativ sein.')).toBeTruthy();
    expect(createFood).not.toHaveBeenCalled();
  });

  it('accepts kcal with one decimal typed with a comma', async () => {
    createFood.mockResolvedValue({ id: 'f' });
    renderEditor();
    fill({ ...valid, Kalorien: '371,5' });
    save();
    await saved();
    expect(createFood).toHaveBeenCalledWith(expect.objectContaining({ kcal: 371.5 }));
  });

  it('lets carbs, protein and fat total 100 g and not a tenth more', async () => {
    createFood.mockResolvedValue({ id: 'f' });
    renderEditor();
    fill({ Kalorien: '500', Kohlenhydrate: '50', Protein: '30', Fett: '20,1' });
    save();
    expect(
      screen.getByText('Kohlenhydrate, Protein und Fett zusammen dürfen höchstens 100 g je 100 g betragen.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Fett').getAttribute('aria-invalid')).toBe('true');
    expect(createFood).not.toHaveBeenCalled();

    fill({ Fett: '20' });
    save();
    await saved();
  });
});

describe('Lebensmittel EAN', () => {
  it.each(['4006381333931', '73513537'])('accepts %s', async (ean) => {
    createFood.mockResolvedValue({ id: 'f' });
    renderEditor();
    fill({ ...valid, EAN: ean });
    save();
    await saved();
    expect(createFood).toHaveBeenCalledWith(expect.objectContaining({ barcode: ean }));
  });

  it('sends a UPC-A in the EAN-13 shape a scan would look up', async () => {
    createFood.mockResolvedValue({ id: 'f' });
    renderEditor();
    fill({ ...valid, EAN: '036000291452' });
    save();
    await saved();
    expect(createFood).toHaveBeenCalledWith(expect.objectContaining({ barcode: '0036000291452' }));
  });

  it.each(['4006381333932', '7351353', '40063813339310', 'abcdefgh'])('refuses %s', (ean) => {
    renderEditor();
    fill({ ...valid, EAN: ean });
    save();
    expect(
      screen.getByText('Bitte gib einen gültigen EAN- oder UPC-Code ein (8, 12 oder 13 Ziffern mit korrekter Prüfziffer).'),
    ).toBeTruthy();
    expect(createFood).not.toHaveBeenCalled();
  });

  it('puts a taken barcode under the EAN field', async () => {
    createFood.mockRejectedValue(new ApiError(409, 'FOOD_BARCODE_TAKEN'));
    renderEditor();
    fill({ ...valid, EAN: '4006381333931' });
    save();
    expect(await screen.findByText('Ein Lebensmittel mit diesem Barcode existiert bereits.')).toBeTruthy();
    expect(notify.error).not.toHaveBeenCalled();
  });
});

describe('Portionsgrößen', () => {
  const addPortion = () => fireEvent.click(screen.getByRole('button', { name: /Größe$/ }));
  const labels = () => screen.getAllByPlaceholderText('Portion, Stück, Scheibe …') as HTMLInputElement[];
  const amounts = () => screen.getAllByPlaceholderText('0').slice(4) as HTMLInputElement[];

  it('takes a label of 60 characters and an amount from 0,1 to 5000', async () => {
    createFood.mockResolvedValue({ id: 'f' });
    renderEditor();
    fill(valid);
    addPortion();
    fireEvent.change(labels()[0], { target: { value: 'p'.repeat(60) } });
    fireEvent.change(amounts()[0], { target: { value: '0,1' } });
    addPortion();
    fireEvent.change(labels()[1], { target: { value: 'groß' } });
    fireEvent.change(amounts()[1], { target: { value: '5000' } });
    save();
    await saved();
  });

  it.each([
    ['p'.repeat(61), '10', 'Die Bezeichnung darf höchstens 60 Zeichen lang sein.'],
    ['', '10', 'Bitte gib der Portionsgröße eine Bezeichnung.'],
    ['Stück', '0,09', 'Die Menge muss mindestens 0,1 g betragen.'],
    ['Stück', '5000,1', 'Die Menge darf höchstens 5.000 g betragen.'],
    ['Stück', '', 'Bitte gib eine Menge an.'],
  ])('refuses label %j with amount %j', (label, grams, message) => {
    renderEditor();
    fill(valid);
    addPortion();
    fireEvent.change(labels()[0], { target: { value: label } });
    fireEvent.change(amounts()[0], { target: { value: grams } });
    save();
    expect(screen.getByText(message)).toBeTruthy();
    expect(createFood).not.toHaveBeenCalled();
  });

  it('names millilitres for a liquid', () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Flüssig (Werte je 100 ml)'));
    fill(valid);
    addPortion();
    fireEvent.change(labels()[0], { target: { value: 'Glas' } });
    fireEvent.change(amounts()[0], { target: { value: '5001' } });
    save();
    expect(screen.getByText('Die Menge darf höchstens 5.000 ml betragen.')).toBeTruthy();
  });

  it('allows ten portion sizes and warns instead of adding an eleventh', () => {
    renderEditor();
    for (let i = 0; i < 10; i++) addPortion();
    expect(labels()).toHaveLength(10);
    addPortion();
    expect(labels()).toHaveLength(10);
    expect(notify.warning).toHaveBeenCalledWith('Du kannst höchstens 10 Portionsgrößen anlegen.');
  });
});
