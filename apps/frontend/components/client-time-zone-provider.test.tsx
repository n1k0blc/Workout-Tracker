// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/de.json';
import { NutritionDayBar } from '@/components/nutrition/nutrition-day-bar';
import { ClientTimeZoneProvider } from './client-time-zone-provider';

// The browser is in Berlin, as is the user. Pinned before any Date is built so the result
// doesn't depend on the machine running the tests.
vi.hoisted(() => {
  process.env.TZ = 'Europe/Berlin';
});

afterEach(cleanup);

// The Pi's container has no TZ, so next-intl's server config -- and with it the provider
// the client inherits -- answers in UTC. Local midnight on 1 November in Berlin is still
// 31 October in UTC, which is the day the bar used to print.
function renderDayBarOnUtcServer() {
  return render(
    <NextIntlClientProvider locale="de" messages={messages} timeZone="UTC">
      <ClientTimeZoneProvider>
        <NutritionDayBar date="2026-11-01" today="2026-11-01" onChange={() => {}} />
      </ClientTimeZoneProvider>
    </NextIntlClientProvider>,
  );
}

describe('ClientTimeZoneProvider', () => {
  it("formats a calendar day in the browser's zone, not the server's", () => {
    renderDayBarOnUtcServer();

    expect(screen.getByText('So., 01.11.2026')).toBeTruthy();
    expect(screen.queryByText('Sa., 31.10.2026')).toBeNull();
  });
});
