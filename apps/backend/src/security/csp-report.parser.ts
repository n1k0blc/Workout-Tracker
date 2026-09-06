import type { INestApplication } from '@nestjs/common';
import { json } from 'express';

export const CSP_REPORT_PATH = '/api/security/csp-report';

// Browsers post CSP violation reports as application/csp-report or
// application/reports+json, which the default JSON body parser ignores (issue #125).
//
// Two details here are load-bearing:
//  - Scoped to the report path, so the 16kb cap never applies to real API traffic.
//  - The middleware must NOT be named `jsonParser`. Nest skips registering its own
//    body parser when it finds a middleware by that name already in the stack
//    (ExpressAdapter.isMiddlewareApplied), and express.json() returns a function named
//    exactly that. Registering it bare left every other JSON request body unparsed,
//    which broke login and registration in production.
export function registerCspReportParser(app: INestApplication): void {
  const parse = json({
    type: ['application/csp-report', 'application/reports+json'],
    limit: '16kb',
  });

  app.use(CSP_REPORT_PATH, function cspReportBodyParser(req: any, res: any, next: any) {
    parse(req, res, next);
  });
}
