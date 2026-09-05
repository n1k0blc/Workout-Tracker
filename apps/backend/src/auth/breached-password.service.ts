import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

const DEFAULT_API_URL = 'https://api.pwnedpasswords.com/range';
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Screens passwords against the Have I Been Pwned "Pwned Passwords" corpus using
 * the k-anonymity range API: only the first 5 characters of the SHA-1 hash ever
 * leave this process, never the password or its full hash.
 *
 * Fallback policy: if the API is unreachable, times out, or answers with a
 * non-200, `isBreached` resolves `false` (fail open). Blocking registration
 * because a third-party service is down would be a self-inflicted outage, and
 * the length rule still applies. The event is logged as a warning so a
 * persistent outage is visible.
 */
@Injectable()
export class BreachedPasswordService {
  private readonly logger = new Logger(BreachedPasswordService.name);
  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    this.apiUrl = (configService.get<string>('PWNED_PASSWORDS_API_URL') || DEFAULT_API_URL).replace(
      /\/$/,
      '',
    );
    this.timeoutMs =
      configService.get<number>('PWNED_PASSWORDS_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS;
  }

  async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    let body: string;
    try {
      body = await this.fetchRange(prefix);
    } catch (error) {
      this.logger.warn(
        `Pwned Passwords lookup failed, allowing password through: ${(error as Error).message}`,
      );
      return false;
    }

    return body.split('\n').some((line) => {
      const [lineSuffix, count] = line.split(':');
      // Skip the zero-count decoys HIBP mixes in for the Add-Padding response.
      return lineSuffix?.trim().toUpperCase() === suffix && count?.trim() !== '0';
    });
  }

  private async fetchRange(prefix: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.apiUrl}/${prefix}`, {
        signal: controller.signal,
        // Ask HIBP to pad the response so its size can't hint at the match count.
        headers: { 'Add-Padding': 'true' },
      });
      if (!response.ok) {
        throw new Error(`unexpected status ${response.status}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }
}
