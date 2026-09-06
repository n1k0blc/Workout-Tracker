import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

interface NormalizedReport {
  documentUri: string;
  blockedUri: string;
  directive: string;
  sample: string;
}

// A CSP violation arrives either in the legacy shape ({ "csp-report": {...} },
// Content-Type application/csp-report) or via the Reporting API (an array of
// { type: "csp-violation", body: {...} }, Content-Type application/reports+json).
export function normalizeCspReports(body: unknown): NormalizedReport[] {
  const pick = (v: unknown): string => (typeof v === 'string' && v ? v.slice(0, 300) : '');

  const fromLegacy = (r: Record<string, unknown>): NormalizedReport => ({
    documentUri: pick(r['document-uri']),
    blockedUri: pick(r['blocked-uri']),
    directive: pick(r['effective-directive'] || r['violated-directive']),
    sample: pick(r['script-sample']),
  });
  const fromReportingApi = (r: Record<string, unknown>): NormalizedReport => ({
    documentUri: pick(r.documentURL),
    blockedUri: pick(r.blockedURL),
    directive: pick(r.effectiveDirective),
    sample: pick(r.sample),
  });

  if (Array.isArray(body)) {
    return body
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .filter((e) => e.type === 'csp-violation' && e.body && typeof e.body === 'object')
      .map((e) => fromReportingApi(e.body as Record<string, unknown>));
  }
  if (body && typeof body === 'object' && 'csp-report' in body) {
    const inner = (body as Record<string, unknown>)['csp-report'];
    if (inner && typeof inner === 'object') return [fromLegacy(inner as Record<string, unknown>)];
  }
  return [];
}

@Controller('security')
export class SecurityController {
  private readonly logger = new Logger('CspReport');

  // Phase 1 of issue #125: the policy ships as report-only, and this endpoint is
  // where the violations land. Read them with:
  //   docker logs workout-tracker-backend-prod 2>&1 | grep CspReport
  // Unauthenticated by design (browsers send reports with no credentials) and
  // exempt from CSRF (see csrf.middleware EXEMPT_PATHS). Throttled so a
  // violation storm from one client cannot flood the logs.
  @Post('csp-report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  ingest(@Body() body: unknown): void {
    const reports = normalizeCspReports(body);
    if (reports.length === 0) {
      this.logger.warn('CSP report received in an unrecognised shape');
      return;
    }
    for (const r of reports) {
      this.logger.warn(
        `violated=${r.directive || '?'} blocked=${r.blockedUri || '?'} document=${r.documentUri || '?'}` +
          (r.sample ? ` sample=${JSON.stringify(r.sample)}` : ''),
      );
    }
  }
}
