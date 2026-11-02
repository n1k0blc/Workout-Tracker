// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import PastWorkoutDetailsDialog from './past-workout-details-dialog';

/**
 * Date and duration of a workout tracked afterwards (#230): the date runs from 2000-01-01 through
 * the user's today, the typed duration is 1-480 whole minutes. "Today" is pinned here.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 2, 0, 30));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function open() {
  const onConfirm = vi.fn();
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <PastWorkoutDetailsDialog onBack={() => {}} onConfirm={onConfirm} />
    </NextIntlClientProvider>,
  );
  return onConfirm;
}
const date = () => screen.getByLabelText('Workout-Datum') as HTMLInputElement;
const minutes = () => screen.getByLabelText('Workout-Dauer (Minuten)') as HTMLInputElement;
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Weiter zur Gym Auswahl' }));

describe('past workout date and duration', () => {
  it('starts on the local today with 60 minutes and hands both on', () => {
    const onConfirm = open();
    expect(date().value).toBe('2026-11-02');
    next();
    expect(onConfirm).toHaveBeenCalledWith({ date: '2026-11-02', durationSeconds: 3600 });
  });

  it.each([
    ['1', 60],
    ['480', 28800],
  ])('accepts %s minutes', (typed, seconds) => {
    const onConfirm = open();
    fireEvent.change(minutes(), { target: { value: typed } });
    next();
    expect(onConfirm).toHaveBeenCalledWith({ date: '2026-11-02', durationSeconds: seconds });
  });

  it.each([
    ['0', 'Die Dauer muss mindestens 1 Minute betragen.'],
    ['481', 'Die Dauer darf höchstens 480 Minuten betragen.'],
    ['', 'Bitte gib die Dauer in Minuten ein.'],
    ['90.5', 'Bitte gib die Dauer in ganzen Minuten ein.'],
  ])('refuses %j minutes and says why', (typed, message) => {
    const onConfirm = open();
    fireEvent.change(minutes(), { target: { value: typed } });
    next();
    expect(screen.getByText(message)).toBeTruthy();
    expect(minutes().getAttribute('aria-invalid')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each(['2000-01-01', '2026-11-02'])('accepts the date %s', (day) => {
    const onConfirm = open();
    fireEvent.change(date(), { target: { value: day } });
    next();
    expect(onConfirm).toHaveBeenCalled();
  });

  it.each([
    ['1999-12-31', 'Das Datum liegt zu weit in der Vergangenheit.'],
    ['2026-11-03', 'Das Datum darf nicht in der Zukunft liegen.'],
    ['', 'Bitte wähle ein Datum.'],
  ])('refuses the date %j', (day, message) => {
    const onConfirm = open();
    fireEvent.change(date(), { target: { value: day } });
    next();
    expect(screen.getByText(message)).toBeTruthy();
    expect(date().getAttribute('aria-invalid')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('limits the native pickers to the same window', () => {
    open();
    expect(date().min).toBe('2000-01-01');
    expect(date().max).toBe('2026-11-02');
    expect(minutes().min).toBe('1');
    expect(minutes().max).toBe('480');
  });
});
