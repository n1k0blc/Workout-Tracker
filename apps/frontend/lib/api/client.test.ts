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
