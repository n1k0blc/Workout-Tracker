// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';

const { push, replace, getCycles, warning } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  getCycles: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, replace }),
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

// The wizard itself is not under test; a marker shows whether the route let it render.
vi.mock('@/components/cycles/cycle-wizard', () => ({
  default: () => <div>wizard-open</div>,
}));

import NewCyclePage from './page';

function renderPage(locale: 'de' | 'en' = 'de') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'de' ? deMessages : enMessages}>
      <NewCyclePage />
    </NextIntlClientProvider>,
  );
}

const cycle = (status: 'ACTIVE' | 'COMPLETED', startDate = '2026-01-05T00:00:00.000Z') => ({
  id: `cycle-${status}-${startDate}`,
  name: 'Push/Pull',
  duration: 8,
  startDate,
  status,
  workoutDays: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

/**
 * The wizard route is the one gate for every way in -- the Zyklen page, the dashboard card,
 * a past Zyklus, a typed URL (#226). Rendering the page is what a typed URL does.
 */
describe('new Zyklus route guard', () => {
  it('opens the wizard when the user has no active Zyklus, only past ones', async () => {
    getCycles.mockResolvedValue([cycle('COMPLETED'), cycle('COMPLETED', '2025-06-01T00:00:00.000Z')]);

    renderPage();

    expect(await screen.findByText('wizard-open')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });

  it('redirects to the Zyklen page with a German toast when a Zyklus is active', async () => {
    getCycles.mockResolvedValue([cycle('COMPLETED'), cycle('ACTIVE')]);

    renderPage('de');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cycles'));
    expect(warning).toHaveBeenCalledWith(
      'Es existiert bereits ein aktiver Zyklus. Bitte beende diesen zuerst.',
    );
    expect(screen.queryByText('wizard-open')).toBeNull();
  });

  it('shows the toast in English for an English user', async () => {
    getCycles.mockResolvedValue([cycle('ACTIVE')]);

    renderPage('en');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cycles'));
    expect(warning).toHaveBeenCalledWith('An active cycle already exists. Please complete it first.');
  });

  it('counts a Zyklus scheduled for the future as active', async () => {
    getCycles.mockResolvedValue([cycle('ACTIVE', '2099-01-04T00:00:00.000Z')]);

    renderPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cycles'));
    expect(screen.queryByText('wizard-open')).toBeNull();
  });

  it('never shows the wizard while the lookup is still pending', () => {
    getCycles.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.queryByText('wizard-open')).toBeNull();
  });

  it('opens the wizard when the lookup fails, leaving the server as the authority', async () => {
    getCycles.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(await screen.findByText('wizard-open')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
