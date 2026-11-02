// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';

const { getWorkoutHistory } = vi.hoisted(() => ({ getWorkoutHistory: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiClient: { getWorkoutHistory } }));
vi.mock('@/components/protected-route', () => ({ ProtectedRoute: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));

import HistoryPage from './page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** The custom range in Verlauf (#230): start on or before end, or an error instead of an empty list. */
async function openCustomRange() {
  getWorkoutHistory.mockResolvedValue([]);
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <HistoryPage />
    </NextIntlClientProvider>,
  );
  await waitFor(() => expect(getWorkoutHistory).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('radio', { name: 'Benutzerdefiniert' }));
  getWorkoutHistory.mockClear();
}
const from = () => screen.getByLabelText('Von') as HTMLInputElement;
const to = () => screen.getByLabelText('Bis') as HTMLInputElement;

describe('Verlauf custom range', () => {
  it('loads a range that starts and ends on the same day', async () => {
    await openCustomRange();
    fireEvent.change(from(), { target: { value: '2026-10-05' } });
    fireEvent.change(to(), { target: { value: '2026-10-05' } });

    await waitFor(() => expect(getWorkoutHistory).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Das Ende darf nicht vor dem Start liegen.')).toBeNull();
  });

  it('says the end cannot precede the start, under the end field, and sends no request', async () => {
    await openCustomRange();
    fireEvent.change(from(), { target: { value: '2026-10-06' } });
    fireEvent.change(to(), { target: { value: '2026-10-05' } });

    expect(await screen.findByText('Das Ende darf nicht vor dem Start liegen.')).toBeTruthy();
    expect(to().getAttribute('aria-invalid')).toBe('true');
    expect(getWorkoutHistory).not.toHaveBeenCalled();
  });

  it('shows no error and loads nothing while one end is still blank', async () => {
    await openCustomRange();
    fireEvent.change(from(), { target: { value: '2026-10-06' } });

    expect(screen.queryByText('Das Ende darf nicht vor dem Start liegen.')).toBeNull();
    expect(getWorkoutHistory).not.toHaveBeenCalled();
  });
});
