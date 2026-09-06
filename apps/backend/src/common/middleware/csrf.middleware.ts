import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqualStrings } from '../utils/token.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Entry points that establish or replace a session rather than acting on an existing
// one. They don't need double-submit CSRF protection: register/login require the
// attacker to already know the victim's credentials, and refresh is protected by the
// httpOnly refresh cookie itself (SameSite=Lax + rotation/reuse-detection).
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  // Browser-sent CSP violation reports carry no cookies and no CSRF token (issue #125).
  '/api/security/csp-report',
]);

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // req.path is relative to this middleware's mount point (Nest mounts it under
    // the global prefix), so match on originalUrl for the full, stable request path.
    const path = req.originalUrl.split('?')[0];

    if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(path)) {
      return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.header(CSRF_HEADER);

    if (!cookieToken || !headerToken || !timingSafeEqualStrings(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    next();
  }
}
