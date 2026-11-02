// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';

/**
 * The two typed values on the active workout screen (#230): the minutes of a workout tracked
 * afterwards (1-480), and the name of the Vorlage the finished workout is saved as (1-100).
 */

const notify = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/toast', () => ({ notify }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/workout/exercise-card', () => ({ default: () => null }));
vi.mock('@/components/workout/exercise-selection-modal', () => ({
  default: ({ open, onSelect }: { open: boolean; onSelect: (id: string) => void }) =>
    open ? <button onClick={() => onSelect('new-exercise')}>pick</button> : null,
}));
vi.mock('@/components/workout/workout-timer', () => ({ default: () => null }));
vi.mock('@/components/workout/rest-timer-display', () => ({ RestTimerDisplay: () => null }));
vi.mock('@/lib/api', () => ({ apiClient: { getPersonalRecords: vi.fn().mockResolvedValue({ recentPRs: [] }) } }));

const completeWorkout = vi.fn();
const addExercise = vi.fn();
const setPastWorkoutDuration = vi.fn();
let context: Record<string, unknown>;
vi.mock('@/lib/workout-context', () => ({ useWorkout: () => context }));

import ActiveWorkoutScreen from './active-workout-screen';

function setContext(overrides: Record<string, unknown> = {}) {
  context = {
    activeWorkout: {
      id: 'w1',
      isFreeWorkout: true,
      originTemplateName: 'Push',
      // One fully logged working set, so "Beenden" (the completeness rule, #228) opens the dialog.
      exercises: [
        {
          id: 'e1',
          exerciseName: 'Bankdrücken',
          plannedSets: [],
          sets: [{ id: 's1', setNumber: 1, setType: 'WORKING', reps: 8, weight: 80, rir: 2 }],
        },
      ],
    },
    completeWorkout,
    discardWorkout: vi.fn(),
    addExercise,
    reorderExercises: vi.fn(),
    loading: false,
    workoutDuration: 0,
    isPaused: false,
    togglePause: vi.fn(),
    isPastWorkout: false,
    pastWorkoutDuration: 3600,
    setPastWorkoutDuration,
    isMinimized: false,
    setRowState: { skipped: {}, added: {} },
    ...overrides,
  };
}

function renderScreen() {
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <ActiveWorkoutScreen />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('typed minutes of a workout tracked afterwards', () => {
  const minutesField = () => screen.getByLabelText(/Dauer/) as HTMLInputElement;
  const finish = () => fireEvent.click(screen.getByRole('button', { name: deMessages.ActiveWorkout.finish }));

  it.each([
    [60, 1],
    [28800, 480],
  ])('lets %i seconds (%i minutes) through to the confirmation', (seconds) => {
    setContext({ isPastWorkout: true, pastWorkoutDuration: seconds });
    renderScreen();
    expect(minutesField().getAttribute('aria-invalid')).toBeNull();
    finish();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it.each([
    [0, 'Die Dauer muss mindestens 1 Minute betragen.'],
    [28860, 'Die Dauer darf höchstens 480 Minuten betragen.'],
  ])('refuses %i seconds: the message is under the field and finishing is stopped', (seconds, message) => {
    setContext({ isPastWorkout: true, pastWorkoutDuration: seconds });
    renderScreen();
    expect(screen.getByText(message)).toBeTruthy();
    expect(minutesField().getAttribute('aria-invalid')).toBe('true');
    finish();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(notify.error).toHaveBeenCalledWith(message);
  });
});

describe('name of the Vorlage a workout is saved as', () => {
  async function openSaveAsNew() {
    setContext();
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: deMessages.ActiveWorkout.finish }));
    const checkboxes = await screen.findAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]);
    return screen.findByPlaceholderText(deMessages.ActiveWorkout.finishDialog.templateSection.namePlaceholder);
  }
  const confirm = () =>
    fireEvent.click(screen.getByRole('button', { name: deMessages.ActiveWorkout.finishDialog.confirm }));

  it('saves with 100 characters', async () => {
    completeWorkout.mockResolvedValue({ id: 'w1' });
    const field = await openSaveAsNew();
    fireEvent.change(field, { target: { value: 'v'.repeat(100) } });
    confirm();
    await waitFor(() =>
      expect(completeWorkout).toHaveBeenCalledWith(
        expect.objectContaining({ saveAsTemplateName: 'v'.repeat(100) }),
      ),
    );
  });

  it('refuses 101 characters and a blank name, each with its reason under the field', async () => {
    const field = await openSaveAsNew();
    fireEvent.change(field, { target: { value: 'v'.repeat(101) } });
    confirm();
    expect(screen.getByText('Der Name der Vorlage darf höchstens 100 Zeichen lang sein.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(field, { target: { value: '  ' } });
    confirm();
    expect(screen.getByText('Bitte gib einen Namen für die Vorlage ein.')).toBeTruthy();
    expect(completeWorkout).not.toHaveBeenCalled();
  });
});

describe('number of Übungen in a workout', () => {
  const exercises = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `e${i}`,
      exerciseId: `x${i}`,
      exerciseName: `Übung ${i}`,
      plannedSets: [],
      sets: [{ id: `s${i}`, setNumber: 1, setType: 'WORKING', reps: 8, weight: 80, rir: 2 }],
    }));

  function pickAnother(count: number) {
    setContext({ activeWorkout: { id: 'w1', isFreeWorkout: true, originTemplateName: 'Push', exercises: exercises(count) } });
    addExercise.mockResolvedValue('new-id');
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: deMessages.ActiveWorkout.addExerciseAria }));
    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
  }

  it('adds the thirtieth', async () => {
    pickAnother(29);
    await waitFor(() => expect(addExercise).toHaveBeenCalledWith('new-exercise'));
  });

  it('refuses a thirty-first with a toast and keeps the picker open', () => {
    pickAnother(30);
    expect(addExercise).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledWith('Ein Workout kann höchstens 30 Übungen enthalten.');
    expect(screen.getByRole('button', { name: 'pick' })).toBeTruthy();
  });
});
