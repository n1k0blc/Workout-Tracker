// @vitest-environment jsdom
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

function sentCall(fetchMock: ReturnType<typeof mockFetch>): [string, { method?: string }] {
  return fetchMock.mock.calls[0] as [string, { method?: string }];
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

describe('client locale header (#179)', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('tells the server which [locale] URL segment the request was made under, on every request', async () => {
    window.history.pushState({}, '', '/de/dashboard');
    const fetchMock = mockFetch();

    await apiClient.getSuggestedWorkout();

    expect(sentHeaders(fetchMock)['X-Locale']).toBe('de');
  });

  it('falls back to the routing default when the pathname carries no recognised locale', async () => {
    window.history.pushState({}, '', '/');
    const fetchMock = mockFetch();

    await apiClient.getSuggestedWorkout();

    expect(sentHeaders(fetchMock)['X-Locale']).toBe('en');
  });
});

describe('shared session refresh on concurrent 401s (#158)', () => {
  // Simulates the 15-minute access cookie expiring while several requests are in flight:
  // every one of them 401s, but only one may rotate the refresh token or the rest arrive
  // with a token the first already superseded and the server kills the whole session.
  function mockFetchWithRefresh(refreshOk: boolean) {
    let refreshCalls = 0;
    let tokenValid = false; // the access cookie starts out already expired
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        tokenValid = refreshOk;
        return { ok: refreshOk, status: refreshOk ? 200 : 401, text: async () => '' };
      }
      if (!tokenValid) {
        return { ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) };
      }
      return { ok: true, status: 200, text: async () => 'null' };
    });
    vi.stubGlobal('fetch', fetchMock);
    return {
      fetchMock,
      refreshCallCount: () => refreshCalls,
      expireToken: () => {
        tokenValid = false;
      },
    };
  }

  it('issues one refresh for five parallel 401s and retries every one of them once it succeeds', async () => {
    const { refreshCallCount } = mockFetchWithRefresh(true);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => apiClient.getProfile()),
    );

    expect(refreshCallCount()).toBe(1);
    expect(results).toHaveLength(5);
  });

  it('does not let each waiter start its own refresh when the shared one fails', async () => {
    const { refreshCallCount } = mockFetchWithRefresh(false);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () => apiClient.getProfile()),
    );

    expect(refreshCallCount()).toBe(1);
    expect(outcomes.every(o => o.status === 'rejected')).toBe(true);
  });

  it('starts a new refresh for a later 401 once the previous one has settled', async () => {
    const { refreshCallCount, expireToken } = mockFetchWithRefresh(true);

    await apiClient.getProfile();
    expireToken();
    await apiClient.getProfile();

    expect(refreshCallCount()).toBe(2);
  });

  it('never refreshes for a 401 on an /auth/* endpoint itself', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiClient.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('favorites endpoints (#148)', () => {
  it('POSTs to star a food and DELETEs to unstar it', async () => {
    const fetchMock = mockFetch();
    await apiClient.setFoodFavorite('food-1', true);
    expect(sentCall(fetchMock)[0]).toContain('/favorites/foods/food-1');
    expect(sentCall(fetchMock)[1].method).toBe('POST');

    vi.unstubAllGlobals();
    const unstar = mockFetch();
    await apiClient.setFoodFavorite('food-1', false);
    expect(sentCall(unstar)[1].method).toBe('DELETE');
  });

  it('narrows the picker lists to foods with scope=food', async () => {
    const fetchMock = mockFetch();
    await apiClient.getPickerFavorites('food');
    expect(sentCall(fetchMock)[0]).toContain('/nutrition/picker/favorites?scope=food');

    vi.unstubAllGlobals();
    const all = mockFetch();
    await apiClient.getPickerRecent();
    expect(sentCall(all)[0]).toContain('/nutrition/picker/recent');
    expect(sentCall(all)[0]).not.toContain('scope');
  });
});
