import { Logger, UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';
import { hashToken } from '../common/utils/token.util';

/**
 * A fake `refreshToken` table that actually enforces the conditional `WHERE revokedAt IS
 * NULL` a real database would, so a race between concurrent `rotate()` calls resolves the
 * same way it would against Postgres: only the update that lands while the row is still
 * unrevoked affects a row (#159). Prisma mocks that just return canned promises can't
 * reproduce this -- the race only exists because the real WHERE clause is evaluated
 * per-call against shared, mutable row state.
 */
interface Row {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
}

function makeFakePrisma() {
  const rows = new Map<string, Row>();

  function findMatches(where: Record<string, unknown>): Row[] {
    return [...rows.values()].filter((row) => {
      if ('id' in where && row.id !== where.id) return false;
      if ('tokenHash' in where && row.tokenHash !== where.tokenHash) return false;
      if ('userId' in where && row.userId !== where.userId) return false;
      if ('revokedAt' in where && where.revokedAt === null && row.revokedAt !== null) return false;
      if ('expiresAt' in where) {
        const filter = where.expiresAt as { gt: Date };
        if (row.expiresAt.getTime() <= filter.gt.getTime()) return false;
      }
      if ('createdAt' in where) {
        const filter = where.createdAt as { lte: Date };
        if (row.createdAt.getTime() > filter.lte.getTime()) return false;
      }
      return true;
    });
  }

  const refreshToken = {
    findUnique: async ({ where }: { where: Record<string, unknown> }) =>
      findMatches(where)[0] ?? null,
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
      const matches = findMatches(where);
      matches.forEach((row) => Object.assign(row, data));
      return { count: matches.length };
    },
    create: async ({
      data,
    }: {
      data: Omit<Row, 'id' | 'revokedAt' | 'replacedByTokenHash' | 'createdAt'> &
        Partial<Pick<Row, 'createdAt'>>;
    }) => {
      const row: Row = {
        id: `row-${rows.size + 1}`,
        createdAt: new Date(),
        revokedAt: null,
        replacedByTokenHash: null,
        ...data,
      };
      rows.set(row.id, row);
      return row;
    },
  };

  const prisma = {
    refreshToken,
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  };

  return { prisma, rows };
}

function seedToken(rows: Map<string, Row>, overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: overrides.id ?? 'row-seed',
    userId: 'user-1',
    tokenHash: hashToken('raw-token'),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    replacedByTokenHash: null,
    ...overrides,
  };
  rows.set(row.id, row);
  return row;
}

describe('RefreshTokenService.rotate', () => {
  it('issues a new token and revokes the presented one', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows);
    const service = new RefreshTokenService(prisma as any);

    const result = await service.rotate('raw-token');

    expect(result.userId).toBe('user-1');
    expect(rows.get('row-seed')?.revokedAt).not.toBeNull();
    expect(rows.get('row-seed')?.replacedByTokenHash).toBe(hashToken(result.rawToken));
  });

  it('rejects an unknown token', async () => {
    const { prisma } = makeFakePrisma();
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('never-issued')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token without rotating it', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { expiresAt: new Date(Date.now() - 1000) });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow('Refresh token expired');
    expect(rows.get('row-seed')?.revokedAt).toBeNull();
  });

  it('revokes sessions predating the supersession when an already-rotated token is presented again well after rotation (reuse)', async () => {
    const { prisma, rows } = makeFakePrisma();
    const supersededAt = new Date(Date.now() - 60_000);
    seedToken(rows, { revokedAt: supersededAt, replacedByTokenHash: 'some-hash' });
    seedToken(rows, {
      id: 'row-older',
      tokenHash: 'other-hash',
      createdAt: new Date(supersededAt.getTime() - 10_000),
    });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow('Refresh token reuse detected');
    expect(rows.get('row-older')?.revokedAt).not.toBeNull();
  });

  it('rejects a token rotated moments ago without treating it as reuse (benign collision)', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { revokedAt: new Date(), replacedByTokenHash: 'some-hash' });
    seedToken(rows, { id: 'row-other', tokenHash: 'other-hash' });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow('Refresh token already rotated');
    // The other session must survive -- this wasn't treated as theft.
    expect(rows.get('row-other')?.revokedAt).toBeNull();
  });

  it('#159 regression: five simultaneous refreshes of the same cookie produce one success and four rejections', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows);
    const service = new RefreshTokenService(prisma as any);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.rotate('raw-token')),
    );

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    // The four losers were rejected outright -- they must not have torn down the winner's
    // brand new session by triggering family-wide revocation.
    const survivors = [...rows.values()].filter((row) => row.revokedAt === null);
    expect(survivors).toHaveLength(1);
  });

  it('a token can never end up with two live successors', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows);
    const service = new RefreshTokenService(prisma as any);

    await Promise.allSettled(Array.from({ length: 5 }, () => service.rotate('raw-token')));

    const successorHashes = new Set(
      [...rows.values()].map((row) => row.replacedByTokenHash).filter(Boolean),
    );
    expect(successorHashes.size).toBeLessThanOrEqual(1);
  });
});

// #161: reuse detection must still end whatever predates the compromised token, but a
// sign-in that happened *after* it was superseded is a different, unrelated session and
// must not become collateral damage from a single late/stale request.
describe('RefreshTokenService reuse detection spares newer sessions (#161)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reproduces the production sequence: sign in, refresh, sign in again, then a late refresh with the first cookie -- the second session still works', async () => {
    const { prisma } = makeFakePrisma();
    const service = new RefreshTokenService(prisma as any);
    const t0 = Date.now();
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    jest.setSystemTime(t0);

    // Sign in: session 1 is born.
    const session1First = await service.issue('user-1');

    // A normal refresh moments later rotates session 1's token.
    jest.setSystemTime(t0 + 1_000);
    const session1Second = await service.rotate(session1First.rawToken);

    // The user signs in again elsewhere -- a second, independent session.
    jest.setSystemTime(t0 + 2_000);
    const session2First = await service.issue('user-1');

    // A late, stale refresh finally arrives presenting session 1's *original* cookie, well
    // outside the service's collision grace period, so this is treated as a genuine reuse
    // signal rather than a benign race.
    jest.setSystemTime(t0 + 1_000 + 10_000);
    await expect(service.rotate(session1First.rawToken)).rejects.toThrow(
      'Refresh token reuse detected',
    );

    // Session 1's current token predates the compromise reveal and must die with it.
    await expect(service.rotate(session1Second.rawToken)).rejects.toThrow(UnauthorizedException);

    // Session 2 was created after session 1's token was superseded -- it must still work.
    await expect(service.rotate(session2First.rawToken)).resolves.toMatchObject({
      userId: 'user-1',
    });
  });

  it('spares a session created after the token was superseded even without a live successor to rotate', async () => {
    const { prisma, rows } = makeFakePrisma();
    const supersededAt = new Date(Date.now() - 60_000);
    seedToken(rows, { revokedAt: supersededAt, replacedByTokenHash: 'some-hash' });
    seedToken(rows, {
      id: 'row-newer',
      tokenHash: 'newer-hash',
      createdAt: new Date(supersededAt.getTime() + 1_000),
    });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow('Refresh token reuse detected');

    expect(rows.get('row-newer')?.revokedAt).toBeNull();
  });
});

describe('RefreshTokenService.revoke / revokeAllForUser', () => {
  it('revoke is idempotent for an unknown or already-revoked token', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { revokedAt: new Date() });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.revoke('raw-token')).resolves.toBeUndefined();
    await expect(service.revoke('never-issued')).resolves.toBeUndefined();
  });

  it("revokeAllForUser only touches that user's live tokens, and reports how many", async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { id: 'mine', userId: 'user-1' });
    seedToken(rows, { id: 'mine-2', userId: 'user-1', tokenHash: 'mine-2-hash' });
    seedToken(rows, { id: 'theirs', userId: 'user-2', tokenHash: 'other-hash' });
    const service = new RefreshTokenService(prisma as any);

    const count = await service.revokeAllForUser('user-1');

    expect(count).toBe(2);
    expect(rows.get('mine')?.revokedAt).not.toBeNull();
    expect(rows.get('mine-2')?.revokedAt).not.toBeNull();
    expect(rows.get('theirs')?.revokedAt).toBeNull();
  });
});

// #160: the backend must log every rejected refresh (reason + user, never the raw
// token/cookie) so a session problem can be diagnosed from `docker logs` alone.
describe('RefreshTokenService rejection logging (#160)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function loggedLines(): string[] {
    return warnSpy.mock.calls.map((call) => String(call[0]));
  }

  it('logs a warning naming "unknown token" for a token that was never issued', async () => {
    const { prisma } = makeFakePrisma();
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('never-issued')).rejects.toThrow(UnauthorizedException);

    expect(loggedLines()).toEqual([expect.stringContaining('unknown token')]);
  });

  it('logs a warning naming "expired token" and identifying the user', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { expiresAt: new Date(Date.now() - 1000) });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow(UnauthorizedException);

    expect(loggedLines()).toEqual([expect.stringMatching(/expired token.*user-1/)]);
  });

  it('logs a warning naming "superseded token" for the loser of a rotation race, without ending other sessions', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows);
    const service = new RefreshTokenService(prisma as any);

    await Promise.allSettled(Array.from({ length: 5 }, () => service.rotate('raw-token')));

    const supersededLines = loggedLines().filter(
      (line) => line.includes('superseded token') && !line.includes('reused'),
    );
    expect(supersededLines).toHaveLength(4);
    supersededLines.forEach((line) => expect(line).toContain('user-1'));
  });

  it('logs reuse detection with how many sessions it ended', async () => {
    const { prisma, rows } = makeFakePrisma();
    const supersededAt = new Date(Date.now() - 60_000);
    seedToken(rows, { revokedAt: supersededAt, replacedByTokenHash: 'some-hash' });
    seedToken(rows, {
      id: 'row-older',
      tokenHash: 'other-hash',
      createdAt: new Date(supersededAt.getTime() - 10_000),
    });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow('Refresh token reuse detected');

    expect(loggedLines()).toEqual([
      expect.stringMatching(/superseded token reused.*user-1.*ended 1 session/),
    ]);
  });

  it('never writes the raw token into a log line, only a short hash prefix', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { expiresAt: new Date(Date.now() - 1000) });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow(UnauthorizedException);

    const [line] = loggedLines();
    expect(line).not.toContain('raw-token');
    const fullHash = hashToken('raw-token');
    expect(line).not.toContain(fullHash);
    expect(line).toContain(fullHash.slice(0, 8));
  });
});
