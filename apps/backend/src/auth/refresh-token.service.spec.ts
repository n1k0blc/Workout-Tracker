import { UnauthorizedException } from '@nestjs/common';
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
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
}

function makeFakePrisma() {
  const rows = new Map<string, Row>();

  function findMatches(where: Record<string, unknown>): Row[] {
    return [...rows.values()].filter(row => {
      if ('id' in where && row.id !== where.id) return false;
      if ('tokenHash' in where && row.tokenHash !== where.tokenHash) return false;
      if ('userId' in where && row.userId !== where.userId) return false;
      if ('revokedAt' in where && where.revokedAt === null && row.revokedAt !== null) return false;
      return true;
    });
  }

  const refreshToken = {
    findUnique: async ({ where }: { where: Record<string, unknown> }) =>
      findMatches(where)[0] ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Partial<Row>;
    }) => {
      const matches = findMatches(where);
      matches.forEach(row => Object.assign(row, data));
      return { count: matches.length };
    },
    create: async ({ data }: { data: Omit<Row, 'id' | 'revokedAt' | 'replacedByTokenHash'> }) => {
      const row: Row = { id: `row-${rows.size + 1}`, revokedAt: null, replacedByTokenHash: null, ...data };
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

  it('revokes the whole family when an already-rotated token is presented again (reuse)', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { revokedAt: new Date(), replacedByTokenHash: 'some-hash' });
    seedToken(rows, { id: 'row-other', tokenHash: 'other-hash' });
    const service = new RefreshTokenService(prisma as any);

    await expect(service.rotate('raw-token')).rejects.toThrow('Refresh token reuse detected');
    expect(rows.get('row-other')?.revokedAt).not.toBeNull();
  });

  it('#159 regression: five simultaneous refreshes of the same cookie produce one success and four rejections', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows);
    const service = new RefreshTokenService(prisma as any);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.rotate('raw-token')),
    );

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    // The four losers were rejected outright -- they must not have torn down the winner's
    // brand new session by triggering family-wide revocation.
    const survivors = [...rows.values()].filter(row => row.revokedAt === null);
    expect(survivors).toHaveLength(1);
  });

  it('a token can never end up with two live successors', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows);
    const service = new RefreshTokenService(prisma as any);

    await Promise.allSettled(Array.from({ length: 5 }, () => service.rotate('raw-token')));

    const successorHashes = new Set(
      [...rows.values()].map(row => row.replacedByTokenHash).filter(Boolean),
    );
    expect(successorHashes.size).toBeLessThanOrEqual(1);
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

  it('revokeAllForUser only touches that user\'s live tokens', async () => {
    const { prisma, rows } = makeFakePrisma();
    seedToken(rows, { id: 'mine', userId: 'user-1' });
    seedToken(rows, { id: 'theirs', userId: 'user-2', tokenHash: 'other-hash' });
    const service = new RefreshTokenService(prisma as any);

    await service.revokeAllForUser('user-1');

    expect(rows.get('mine')?.revokedAt).not.toBeNull();
    expect(rows.get('theirs')?.revokedAt).toBeNull();
  });
});
