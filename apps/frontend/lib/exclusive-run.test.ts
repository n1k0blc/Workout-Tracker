// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAIM_TTL_MS, runExclusively } from '@/lib/exclusive-run';

/** A promise the test settles by hand, to keep a run "in flight" while a second tab tries. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** The slice of the Web Locks API the helper uses: `ifAvailable` answers null while the lock is held. */
function fakeLocks() {
  const held = new Set<string>();
  return {
    request: async (
      name: string,
      _options: { ifAvailable: boolean },
      callback: (lock: object | null) => Promise<unknown>,
    ) => {
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
      }
    },
  };
}

describe.each([
  ['the Web Locks API', true],
  ['the localStorage claim (no Web Locks)', false],
])('runExclusively with %s', (_label, withLocks) => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    if (withLocks) Object.defineProperty(navigator, 'locks', { value: fakeLocks(), configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    if (withLocks) delete (navigator as { locks?: unknown }).locks;
  });

  it('runs the function and hands back its value', async () => {
    const result = await runExclusively('job', async () => 42);
    expect(result).toEqual({ ran: true, value: 42 });
  });

  it('lets only one of two simultaneous callers run', async () => {
    const gate = deferred();
    const fn = vi.fn(() => gate.promise);

    const first = runExclusively('job', fn);
    const second = await runExclusively('job', fn);

    expect(second).toEqual({ ran: false });
    gate.resolve();
    expect((await first).ran).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('is free again once the first run is over', async () => {
    const fn = vi.fn(async () => 'x');
    await runExclusively('job', fn);
    const again = await runExclusively('job', fn);
    expect(again.ran).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('frees the claim when the function throws, and lets the error through', async () => {
    await expect(
      runExclusively('job', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await runExclusively('job', async () => 1)).ran).toBe(true);
  });

  it('does not block a different name', async () => {
    const gate = deferred();
    const first = runExclusively('a', () => gate.promise);
    expect((await runExclusively('b', async () => 1)).ran).toBe(true);
    gate.resolve();
    await first;
  });
});

describe('runExclusively localStorage claim', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('refuses while another tab holds a fresh claim', async () => {
    localStorage.setItem('job', JSON.stringify({ owner: 'other-tab', at: Date.now() }));
    expect(await runExclusively('job', async () => 1)).toEqual({ ran: false });
  });

  it('takes over a claim that has gone stale (a tab that closed mid-run)', async () => {
    localStorage.setItem('job', JSON.stringify({ owner: 'other-tab', at: Date.now() - CLAIM_TTL_MS - 1 }));
    expect((await runExclusively('job', async () => 1)).ran).toBe(true);
  });

  it('takes over a claim it cannot read', async () => {
    localStorage.setItem('job', 'not json');
    expect((await runExclusively('job', async () => 1)).ran).toBe(true);
  });

  it('backs off when a competing tab wrote its claim after ours', async () => {
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      setItem.call(this, k, v);
      // The other tab's write lands right behind ours -- last writer wins.
      setItem.call(this, k, JSON.stringify({ owner: 'other-tab', at: Date.now() }));
    });
    const fn = vi.fn(async () => 1);
    expect(await runExclusively('job', fn)).toEqual({ ran: false });
    expect(fn).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
