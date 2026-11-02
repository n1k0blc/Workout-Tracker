// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';
import { ApiError } from '@/lib/api/errors';

// The router must be referentially stable: the screen reloads its data whenever it changes.
const { push, router, getWorkoutTemplate, updateWorkoutTemplate, notify } = vi.hoisted(() => {
  const push = vi.fn();
  return {
    push,
    router: { push },
    getWorkoutTemplate: vi.fn(),
    updateWorkoutTemplate: vi.fn(),
    notify: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
  };
});

vi.mock('@/i18n/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('@/lib/api', () => ({
  apiClient: {
    getHomeGyms: vi.fn().mockResolvedValue([]),
    getExercises: vi.fn().mockResolvedValue([]),
    getWorkoutTemplate,
    updateWorkoutTemplate,
  },
}));
vi.mock('@/components/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// The exercise cards are not what is under test: the name field and the save feedback are.
vi.mock('@/components/workout/exercise-card', () => ({ default: () => <div data-testid="card" /> }));
vi.mock('@/components/workout/exercise-selection-modal', () => ({ default: () => null }));

import TemplateEditorScreen from './template-editor-screen';

const template = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  name: '',
  isCustom: true,
  recommendedGymId: null,
  exercises: [
    {
      id: 'ex1',
      exerciseId: 'e1',
      exerciseName: 'Kniebeuge',
      order: 1,
      sets: [{ id: 's1', order: 1, setType: 'WORKING', reps: 5, weight: 100, rir: 2, rest: 90 }],
    },
  ],
  ...overrides,
});

async function renderEditor() {
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <TemplateEditorScreen templateId="t1" />
    </NextIntlClientProvider>,
  );
  await screen.findByText('Vorlage bearbeiten');
}

/** Save feedback of the template editor (#231): a field error for the name, a toast for the rest. */
describe('TemplateEditorScreen saving', () => {
  beforeEach(() => {
    updateWorkoutTemplate.mockResolvedValue({});
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a missing name under the name field, not as a native alert', async () => {
    getWorkoutTemplate.mockResolvedValue(template());
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('Bitte gib einen Namen ein.');
    expect(screen.getByPlaceholderText(messages.TemplateEditorScreen.namePlaceholder).getAttribute('aria-invalid')).toBe('true');
    expect(updateWorkoutTemplate).not.toHaveBeenCalled();
  });

  it('shows a taken name under the name field', async () => {
    getWorkoutTemplate.mockResolvedValue(template({ name: 'Push' }));
    updateWorkoutTemplate.mockRejectedValue(new ApiError(409, 'TEMPLATE_NAME_TAKEN'));
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('Eine Vorlage mit diesem Namen existiert bereits.');
    expect(notify.error).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('will not save a planned working set without RIR, and names where it is (#227)', async () => {
    getWorkoutTemplate.mockResolvedValue(
      template({
        name: 'Push',
        exercises: [
          {
            id: 'ex1',
            exerciseId: 'e1',
            exerciseName: 'Kniebeuge',
            order: 1,
            sets: [
              { id: 's1', order: 1, setType: 'WARMUP', reps: 5, weight: 20, rir: null, rest: 90 },
              { id: 's2', order: 2, setType: 'WORKING', reps: 5, weight: 100, rir: null, rest: 90 },
            ],
          },
        ],
      }),
    );
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(notify.warning).toHaveBeenCalledWith('Kniebeuge, Satz 2: Gib einen RIR an.'));
    expect(updateWorkoutTemplate).not.toHaveBeenCalled();
  });

  it('saves a warm-up without RIR and keeps a stored RIR 0 on a working set', async () => {
    getWorkoutTemplate.mockResolvedValue(
      template({
        name: 'Push',
        exercises: [
          {
            id: 'ex1',
            exerciseId: 'e1',
            exerciseName: 'Kniebeuge',
            order: 1,
            sets: [
              { id: 's1', order: 1, setType: 'WARMUP', reps: 5, weight: 20, rir: 3, rest: 90 },
              { id: 's2', order: 2, setType: 'WORKING', reps: 5, weight: 100, rir: 0, rest: 90 },
            ],
          },
        ],
      }),
    );
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(updateWorkoutTemplate).toHaveBeenCalled());
    const [warmup, working] = updateWorkoutTemplate.mock.calls[0][1].exercises[0].sets;
    expect(warmup.rir).toBeUndefined();
    expect(working.rir).toBe(0);
  });

  it('toasts a failure that belongs to no field and stays on the page', async () => {
    getWorkoutTemplate.mockResolvedValue(template({ name: 'Push' }));
    updateWorkoutTemplate.mockRejectedValue(new Error('network down'));
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(notify.error).toHaveBeenCalledWith(messages.ApiErrors.generic));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
