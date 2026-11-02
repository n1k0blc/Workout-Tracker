import { afterEach, describe, expect, it, vi } from 'vitest';

const sonner = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: sonner }));

import { notify } from './toast';

afterEach(() => vi.clearAllMocks());

describe('notify', () => {
  it('shows each kind with its own fixed duration', () => {
    notify.success('saved');
    notify.info('fyi');
    notify.warning('careful');
    notify.error('failed');

    expect(sonner.success).toHaveBeenCalledWith('saved', { duration: 3000 });
    expect(sonner.info).toHaveBeenCalledWith('fyi', { duration: 4000 });
    expect(sonner.warning).toHaveBeenCalledWith('careful', { duration: 6000 });
    expect(sonner.error).toHaveBeenCalledWith('failed', { duration: 8000 });
  });
});
