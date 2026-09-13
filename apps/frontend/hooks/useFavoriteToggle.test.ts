// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useFavoriteToggle } from './useFavoriteToggle';

vi.mock('@/lib/api', () => ({
  apiClient: {
    setFoodFavorite: vi.fn(),
    setMealFavorite: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFavoriteToggle', () => {
  it('overlays the pending toggle optimistically before the request resolves', async () => {
    let resolveRequest: () => void = () => {};
    vi.mocked(apiClient.setFoodFavorite).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = () => resolve(undefined);
      }),
    );
    const { result } = renderHook(() => useFavoriteToggle());

    act(() => {
      result.current.toggleFavorite('food', 'f1', false);
    });

    expect(result.current.effectiveFavorite('food', 'f1', false)).toBe(true);
    resolveRequest();
    await waitFor(() => expect(apiClient.setFoodFavorite).toHaveBeenCalledWith('f1', true));
  });

  it('routes food and meal toggles to their own endpoints', async () => {
    vi.mocked(apiClient.setFoodFavorite).mockResolvedValue(undefined);
    vi.mocked(apiClient.setMealFavorite).mockResolvedValue(undefined);
    const { result } = renderHook(() => useFavoriteToggle());

    await act(() => result.current.toggleFavorite('food', 'f1', false));
    await act(() => result.current.toggleFavorite('meal', 'm1', true));

    expect(apiClient.setFoodFavorite).toHaveBeenCalledWith('f1', true);
    expect(apiClient.setMealFavorite).toHaveBeenCalledWith('m1', false);
  });

  it('reverts the optimistic override and toasts on failure', async () => {
    vi.mocked(apiClient.setFoodFavorite).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useFavoriteToggle());

    await act(() => result.current.toggleFavorite('food', 'f1', false));

    expect(result.current.effectiveFavorite('food', 'f1', false)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Favorit konnte nicht gespeichert werden');
  });

  it('calls onToggled after a successful toggle', async () => {
    vi.mocked(apiClient.setFoodFavorite).mockResolvedValue(undefined);
    const onToggled = vi.fn();
    const { result } = renderHook(() => useFavoriteToggle(onToggled));

    await act(() => result.current.toggleFavorite('food', 'f1', false));

    expect(onToggled).toHaveBeenCalledTimes(1);
  });

  it('reset clears pending overrides', async () => {
    vi.mocked(apiClient.setFoodFavorite).mockResolvedValue(undefined);
    const { result } = renderHook(() => useFavoriteToggle());

    await act(() => result.current.toggleFavorite('food', 'f1', false));
    expect(result.current.effectiveFavorite('food', 'f1', false)).toBe(true);

    act(() => result.current.reset());

    expect(result.current.effectiveFavorite('food', 'f1', false)).toBe(false);
  });
});
