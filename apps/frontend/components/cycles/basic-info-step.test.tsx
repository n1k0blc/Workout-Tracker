// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';
import BasicInfoStep from './basic-info-step';
import type { CycleFormData } from './cycle-wizard';

/**
 * The first Zyklus wizard step (#230): name, duration and start date, each at its last valid and
 * first invalid value. "Today" is the user's local day, pinned here to 2 November 2026.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 2, 0, 30)); // shortly after local midnight
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const base: CycleFormData = { name: 'Push/Pull', duration: 4, startDate: '2026-11-02', workoutDays: [] };

function renderStep(data: Partial<CycleFormData> = {}, locale: 'de' | 'en' = 'de') {
  const updateFormData = vi.fn();
  const onNext = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'de' ? deMessages : enMessages}>
      <BasicInfoStep formData={{ ...base, ...data }} updateFormData={updateFormData} onNext={onNext} />
    </NextIntlClientProvider>,
  );
  return { updateFormData, onNext };
}

const submit = () => fireEvent.submit(document.querySelector('form')!);

describe('Zyklus name', () => {
  it('accepts 100 characters and refuses 101 with the limit named', () => {
    const ok = renderStep({ name: 'n'.repeat(100) });
    submit();
    expect(ok.onNext).toHaveBeenCalled();
    cleanup();

    const tooLong = renderStep({ name: 'n'.repeat(101) });
    submit();
    expect(screen.getByText('Der Name darf höchstens 100 Zeichen lang sein.')).toBeTruthy();
    expect(screen.getByLabelText(/Name/).getAttribute('aria-invalid')).toBe('true');
    expect(tooLong.onNext).not.toHaveBeenCalled();
  });

  it('asks for a name when it is blank', () => {
    const { onNext } = renderStep({ name: '   ' });
    submit();
    expect(screen.getByText('Bitte gib einen Namen ein.')).toBeTruthy();
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe('Zyklus duration', () => {
  const durationField = () => screen.getByLabelText(/Dauer/) as HTMLInputElement;

  it.each([
    ['53', 52],
    ['52', 52],
    ['1', 1],
    ['0', 1],
    ['', 1],
  ])('clamps %j to %i when Enter submits the form, without a blur first', (typed, expected) => {
    const { updateFormData, onNext } = renderStep();
    fireEvent.change(durationField(), { target: { value: typed } });
    submit();

    expect(updateFormData).toHaveBeenLastCalledWith({ duration: expected });
    expect(durationField().value).toBe(String(expected));
    expect(onNext).toHaveBeenCalled();
  });
});

describe('Zyklus start date', () => {
  const startField = () => screen.getByLabelText(/Start/) as HTMLInputElement;

  it('accepts the local today, which is not yet today in UTC', () => {
    // 00:30 local on 2 November: in UTC+ zones the UTC day is still 1 November.
    const { onNext } = renderStep({ startDate: '2026-11-02' });
    submit();
    expect(onNext).toHaveBeenCalled();
  });

  it.each([
    ['2026-11-01', 'Ein Zyklus kann nicht in der Vergangenheit starten.'],
    ['2027-11-03', 'Ein Zyklus kann höchstens ein Jahr im Voraus starten.'],
  ])('refuses %s', (startDate, message) => {
    const { onNext } = renderStep({ startDate });
    submit();
    expect(screen.getByText(message)).toBeTruthy();
    expect(startField().getAttribute('aria-invalid')).toBe('true');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('accepts exactly one year ahead', () => {
    const { onNext } = renderStep({ startDate: '2027-11-02' });
    submit();
    expect(onNext).toHaveBeenCalled();
  });

  it('limits the native picker to the same window', () => {
    renderStep();
    expect(startField().min).toBe('2026-11-02');
    expect(startField().max).toBe('2027-11-02');
  });
});
