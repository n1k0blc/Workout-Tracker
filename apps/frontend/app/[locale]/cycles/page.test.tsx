// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';

const { push, getCycles, warning } = vi.hoisted(() => ({
  push: vi.fn(),
  getCycles: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: { getCycles },
}));

vi.mock('@/lib/toast', () => ({
  notify: { warning, success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import CyclesPage from './page';

const cycle = (status: 'ACTIVE' | 'COMPLETED') => ({
  id: `cycle-${status}`,
  name: `Zyklus ${status}`,
  duration: 8,
  startDate: '2026-01-05T00:00:00.000Z',
  completedAt: status === 'COMPLETED' ? '2026-03-01T00:00:00.000Z' : undefined,
  status,
  workoutDays: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

/**
 * The wizard route is the gate (#226), so the button on this page must not second-guess it:
 * it stays usable even while a Zyklus is active, and just navigates.
 */
describe('Zyklen page "new Zyklus" button', () => {
  it('goes straight to the wizard while a Zyklus is active, without its own check or toast', async () => {
    getCycles.mockResolvedValue([cycle('ACTIVE'), cycle('COMPLETED')]);

    render(
      <NextIntlClientProvider locale="de" messages={messages}>
        <CyclesPage />
      </NextIntlClientProvider>,
    );
    await screen.findByText('Zyklus ACTIVE');
    getCycles.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Neuer Zyklus' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/cycles/new'));
    expect(getCycles).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });
});
