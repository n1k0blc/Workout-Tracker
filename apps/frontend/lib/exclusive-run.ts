/**
 * Run `fn` in at most one tab at a time (#229).
 *
 * Tabs of one browser share the localStorage draft, so two of them can reach the 5-hour outcome
 * together; the outcome (save or discard) must run once. The caller does not wait or queue: a
 * second caller gets `{ ran: false }` straight away and leaves the work to the first.
 *
 * The Web Locks API is the claim where it exists -- it is atomic across tabs and is released by the
 * browser if the holding tab dies. Without it (older Safari, an insecure context) a localStorage
 * claim stands in: write an owner, read it back, and back off if someone else's name is there. That
 * is not atomic, but the window is two storage operations wide, the claim expires after
 * `CLAIM_TTL_MS` so a tab that closes mid-run cannot hold it forever, and the caller re-checks that
 * the draft still exists once inside, so a duplicate would find nothing left to do.
 */

/** A localStorage claim older than this is a tab that died mid-run. */
export const CLAIM_TTL_MS = 2 * 60 * 1000;

export type ExclusiveResult<T> = { ran: true; value: T } | { ran: false };

interface LocksLike {
  request<R>(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: object | null) => Promise<R>,
  ): Promise<R>;
}

function randomOwner(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readClaim(name: string): { owner?: string; at?: number } | null {
  try {
    const raw = localStorage.getItem(name);
    return raw ? (JSON.parse(raw) as { owner?: string; at?: number }) : null;
  } catch {
    return null;
  }
}

export async function runExclusively<T>(name: string, fn: () => Promise<T>): Promise<ExclusiveResult<T>> {
  const locks = (typeof navigator !== 'undefined' ? (navigator as { locks?: LocksLike }).locks : undefined);
  if (locks) {
    return locks.request<ExclusiveResult<T>>(name, { ifAvailable: true }, async (lock) =>
      lock ? { ran: true, value: await fn() } : { ran: false },
    );
  }

  const owner = randomOwner();
  const existing = readClaim(name);
  if (existing && typeof existing.at === 'number' && Date.now() - existing.at < CLAIM_TTL_MS) {
    return { ran: false };
  }
  localStorage.setItem(name, JSON.stringify({ owner, at: Date.now() }));
  if (readClaim(name)?.owner !== owner) return { ran: false };
  try {
    return { ran: true, value: await fn() };
  } finally {
    if (readClaim(name)?.owner === owner) localStorage.removeItem(name);
  }
}
