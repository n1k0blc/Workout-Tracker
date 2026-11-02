// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import WorkoutDaysStep from './workout-days-step';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { homeGyms: [] } }) }));

afterEach(cleanup);

/** A Trainingstag name is 1-50 characters (#230); the dialog says so under the field. */
function openDialog() {
  const updateFormData = vi.fn();
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <WorkoutDaysStep
        formData={{ name: 'Z', duration: 4, startDate: '2026-11-02', workoutDays: [] }}
        updateFormData={updateFormData}
        onNext={() => {}}
        onBack={() => {}}
      />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Trainingstag hinzufügen' }));
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
const name = () => screen.getByLabelText('Trainingsname') as HTMLInputElement;

describe('Trainingstag name', () => {
  it('adds a day named with exactly 50 characters', () => {
    openDialog();
    fireEvent.change(name(), { target: { value: 'd'.repeat(50) } });
    save();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('d'.repeat(50))).toBeTruthy();
  });

  it('refuses 51 characters and names the limit under the field', () => {
    openDialog();
    fireEvent.change(name(), { target: { value: 'd'.repeat(51) } });
    save();
    expect(screen.getByText('Der Name darf höchstens 50 Zeichen lang sein.')).toBeTruthy();
    expect(name().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('asks for a name instead of leaving Hinzufügen dead', () => {
    openDialog();
    save();
    expect(screen.getByText('Bitte gib einen Namen ein.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
