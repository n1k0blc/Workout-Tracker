// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import { ApiError } from '@/lib/api/errors';

const { createExercise } = vi.hoisted(() => ({ createExercise: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiClient: { createExercise, updateExercise: vi.fn() } }));
const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));

import { ExerciseEditorDialog } from './exercise-editor-dialog';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** A custom Übung's name is 1-100 characters, special characters allowed (#230). */
function renderDialog() {
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <ExerciseEditorDialog open onOpenChange={() => {}} />
    </NextIntlClientProvider>,
  );
  return screen.getByLabelText('Name') as HTMLInputElement;
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }));

describe('Übung name', () => {
  it.each(['Pull-up (assisted)', 'ü'.repeat(100)])('creates an Übung named %s', async (name) => {
    createExercise.mockResolvedValue({ id: 'x' });
    fireEvent.change(renderDialog(), { target: { value: name } });
    submit();
    await waitFor(() => expect(createExercise).toHaveBeenCalledWith(expect.objectContaining({ name })));
  });

  it.each([
    ['ü'.repeat(101), 'Der Name darf höchstens 100 Zeichen lang sein.'],
    ['   ', 'Bitte gib einen Namen ein.'],
    ['Zug​kraft', 'Bitte entferne Steuer- oder unsichtbare Zeichen.'],
  ])('refuses %j with the reason under the field', (name, message) => {
    const field = renderDialog();
    fireEvent.change(field, { target: { value: name } });
    submit();
    expect(screen.getByText(message)).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(createExercise).not.toHaveBeenCalled();
  });

  it('shows a server rejection of the name under the field, not as a banner', async () => {
    createExercise.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', [{ property: 'name', constraints: ['maxLength'] }]),
    );
    const field = renderDialog();
    fireEvent.change(field, { target: { value: 'Kniebeuge' } });
    submit();
    expect(await screen.findByText('Der Name darf höchstens 100 Zeichen lang sein.')).toBeTruthy();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
