import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => 'null',
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentHeaders(fetchMock: ReturnType<typeof mockFetch>): Record<string, string> {
  return fetchMock.mock.calls[0][1].headers;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('client timezone header', () => {
  it('tells the server which day it is for the user, on every request', async () => {
    const fetchMock = mockFetch();

    await apiClient.getSuggestedWorkout();

    // The server resolves both "today's weekday" and "was anything logged today" in this zone.
    expect(sentHeaders(fetchMock)['X-Timezone']).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
