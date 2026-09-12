import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateOpaqueToken, hashToken } from '../common/utils/token.util';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface IssuedRefreshToken {
  rawToken: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenService {
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
   * Reuse of an already-rotated token (a strong theft signal) revokes the user's entire
   * token family, forcing re-authentication on every device.
   *
   * The revoke is a conditional write (`WHERE revokedAt IS NULL`), not a read-then-write:
   * when several requests present the same token at the same instant, every one of them
   * can pass the initial read, but only one's UPDATE actually flips `revokedAt` -- the
   * losers' affected-row count comes back 0, so a token can never gain two live successors
   * (#159). Those losers are simply rejected rather than treated as reuse: they raced a
   * legitimate rotation, not replayed a stale token, so the winner's new session stands.
   */
  async rotate(rawToken: string): Promise<{ userId: string } & IssuedRefreshToken> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const nextRawToken = generateOpaqueToken();
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const nextTokenHash = hashToken(nextRawToken);

    await this.prisma.$transaction(async tx => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedByTokenHash: nextTokenHash },
      });

      if (count === 0) {
        throw new UnauthorizedException('Refresh token already rotated');
      }

      await tx.refreshToken.create({
        data: { userId: existing.userId, tokenHash: nextTokenHash, expiresAt: nextExpiresAt },
      });
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

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
