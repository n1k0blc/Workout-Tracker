// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';

const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/protected-route', () => ({ ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/nutrition/scan-flow', () => ({ ScanFlow: () => null }));
vi.mock('@/hooks/usePickerLists', () => ({ usePickerLists: () => ({}) }));
vi.mock('@/lib/api', () => ({ apiClient: { createMeal: vi.fn(), getFoods: vi.fn().mockResolvedValue({ items: [] }) } }));

import MealEditorScreen from './meal-editor-screen';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** A Mahlzeit name is 1-120 characters (#230); a missing ingredient is a flow rule, so a toast. */
function renderEditor() {
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <MealEditorScreen />
    </NextIntlClientProvider>,
  );
  return screen.getByLabelText('Name') as HTMLInputElement;
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

describe('Mahlzeit name', () => {
  it('passes at 120 characters and stops at the ingredient check', () => {
    const field = renderEditor();
    fireEvent.change(field, { target: { value: 'm'.repeat(120) } });
    save();
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(notify.error).toHaveBeenCalledWith('Eine Mahlzeit braucht mindestens eine Zutat.');
  });

  it.each([
    ['m'.repeat(121), 'Der Name darf höchstens 120 Zeichen lang sein.'],
    ['  ', 'Bitte gib einen Namen ein.'],
  ])('refuses %j under the field', (name, message) => {
    const field = renderEditor();
    fireEvent.change(field, { target: { value: name } });
    save();
    expect(screen.getByText(message)).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(notify.error).not.toHaveBeenCalled();
  });
});
