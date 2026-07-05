import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CsrfMiddleware } from './csrf.middleware';

describe('CsrfMiddleware', () => {
  const middleware = new CsrfMiddleware();

  function makeRequest(overrides: {
    method: string;
    path: string;
    cookieToken?: string;
    headerToken?: string;
  }): Request {
    return {
      method: overrides.method,
      originalUrl: overrides.path,
      cookies: overrides.cookieToken ? { csrf_token: overrides.cookieToken } : {},
      header: (name: string) =>
        name.toLowerCase() === 'x-csrf-token' ? overrides.headerToken : undefined,
    } as unknown as Request;
  }

  const res = {} as Response;

  it('allows safe methods (GET) through without a CSRF token', () => {
    const next = jest.fn();
    middleware.use(makeRequest({ method: 'GET', path: '/api/workouts' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  it('exempts POST /api/auth/login without a CSRF token', () => {
    const next = jest.fn();
    middleware.use(makeRequest({ method: 'POST', path: '/api/auth/login' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  it('exempts POST /api/auth/register without a CSRF token', () => {
    const next = jest.fn();
    middleware.use(makeRequest({ method: 'POST', path: '/api/auth/register' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  it('exempts POST /api/auth/refresh without a CSRF token', () => {
    const next = jest.fn();
    middleware.use(makeRequest({ method: 'POST', path: '/api/auth/refresh' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects a mutating request with no CSRF cookie/header at all', () => {
    const next = jest.fn();
    expect(() =>
      middleware.use(makeRequest({ method: 'POST', path: '/api/workouts' }), res, next),
    ).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when the header is missing but the cookie is present', () => {
    const next = jest.fn();
    expect(() =>
      middleware.use(
        makeRequest({ method: 'POST', path: '/api/workouts', cookieToken: 'abc' }),
        res,
        next,
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects when the header does not match the cookie', () => {
    const next = jest.fn();
    expect(() =>
      middleware.use(
        makeRequest({
          method: 'DELETE',
          path: '/api/workouts/1',
          cookieToken: 'abc',
          headerToken: 'def',
        }),
        res,
        next,
      ),
    ).toThrow(ForbiddenException);
  });

  it('strips the query string before matching exempt paths', () => {
    const next = jest.fn();
    middleware.use(
      makeRequest({ method: 'POST', path: '/api/auth/login?redirect=/dashboard' }),
      res,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('allows a mutating request when header matches cookie', () => {
    const next = jest.fn();
    middleware.use(
      makeRequest({
        method: 'PATCH',
        path: '/api/workouts/1',
        cookieToken: 'matching-token',
        headerToken: 'matching-token',
      }),
      res,
      next,
    );
    expect(next).toHaveBeenCalled();
  });
});
