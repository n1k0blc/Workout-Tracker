import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateOpaqueToken, hashToken } from '../common/utils/token.util';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// A concurrent rotation of the very same token can lose the atomic race below by mere
// milliseconds, and at that point the row looks identical to a stale, already-rotated
// token being replayed: both are revoked with a successor already recorded. Only a
// presentation *outside* this short window is treated as reuse (and revokes the whole
// token family); one arriving within it is a benign collision the atomic write already
// resolved, so it is just rejected -- it must not tear down the race winner's brand-new
// session (#159/#160).
const REUSE_GRACE_PERIOD_MS = 5000;

// Identifies a token in logs without ever writing the raw value or the full hash (#160).
function hashPrefix(tokenHash: string): string {
  return tokenHash.slice(0, 8);
}

export interface IssuedRefreshToken {
  rawToken: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    });

    return { rawToken, expiresAt };
  }

  /**
   * Rotates a valid refresh token: revokes the presented one and atomically issues a new one.
   * Reuse of an already-rotated token well outside the grace period (a strong theft signal)
   * ends every session that predates the moment it was superseded, forcing re-authentication
   * wherever the stolen token's lineage could reach -- but spares sessions created afterward
   * (#161): a sign-in that happened *after* the token was rotated away has nothing to do with
   * whoever is now replaying the old one, and a single stale request must not be able to log
   * that later session out.
   *
   * The revoke is a conditional write (`WHERE revokedAt IS NULL`), not a read-then-write:
   * when several requests present the same token at the same instant, every one of them
   * can pass the initial read, but only one's UPDATE actually flips `revokedAt` -- the
   * losers' affected-row count comes back 0, so a token can never gain two live successors
   * (#159). Whether a loser is treated as reuse is decided from a *fresh* re-read taken
   * after losing the race, not from the stale pre-race read -- otherwise every loser would
   * look identical to a genuine stale-token replay and trigger family revocation, tearing
   * down the very session the atomic write just created.
   */
  async rotate(rawToken: string): Promise<{ userId: string } & IssuedRefreshToken> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) {
      this.logger.warn(`Refresh rejected: unknown token (hash ${hashPrefix(tokenHash)})`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRawToken = generateOpaqueToken();
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const nextTokenHash = hashToken(nextRawToken);

    await this.prisma.$transaction(async (tx) => {
      // Both the revoke and the successor's createdAt use this single instant, so a later
      // reuse check can compare "created at/before the supersession" without the successor's
      // own createdAt (a DB-side default) racing the JS clock used for revokedAt.
      const now = new Date();
      const { count } = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, replacedByTokenHash: nextTokenHash },
      });

      if (count === 1) {
        await tx.refreshToken.create({
          data: {
            userId: existing.userId,
            tokenHash: nextTokenHash,
            expiresAt: nextExpiresAt,
            createdAt: now,
          },
        });
        return;
      }

      // Lost the race, or the token was already expired -- re-read to find out which.
      const current = await tx.refreshToken.findUnique({ where: { id: existing.id } });

      if (!current?.revokedAt) {
        this.logger.warn(
          `Refresh rejected: expired token (hash ${hashPrefix(tokenHash)}, user ${existing.userId})`,
        );
        throw new UnauthorizedException('Refresh token expired');
      }

      if (Date.now() - current.revokedAt.getTime() <= REUSE_GRACE_PERIOD_MS) {
        this.logger.warn(
          `Refresh rejected: superseded token (hash ${hashPrefix(tokenHash)}, user ${existing.userId})`,
        );
        throw new UnauthorizedException('Refresh token already rotated');
      }

      const { count: endedCount } = await tx.refreshToken.updateMany({
        where: {
          userId: existing.userId,
          revokedAt: null,
          createdAt: { lte: current.revokedAt },
        },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh rejected: superseded token reused (hash ${hashPrefix(tokenHash)}, ` +
          `user ${existing.userId}) - ended ${endedCount} session(s)`,
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    });

    return { userId: existing.userId, rawToken: nextRawToken, expiresAt: nextExpiresAt };
  }

  /** Idempotent: revoking an unknown/already-revoked token is a no-op success. */
  async revoke(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Returns how many live sessions were ended, so reuse detection can log the blast radius. */
  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }
}
