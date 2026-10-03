import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConflictException } from './app-exceptions';
import { ApiExceptionFilter } from './api-exception.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const log = jest.fn();
  new ApiExceptionFilter(log).catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0], log };
}

describe('ApiExceptionFilter — no prose on the wire (#191)', () => {
  it('answers an App exception with statusCode, code and details only', () => {
    const { status, body } = run(new AppConflictException('MEAL_SLOT_LAST_ACTIVE', { a: 1 }));

    expect(status).toBe(409);
    expect(body).toEqual({ statusCode: 409, code: 'MEAL_SLOT_LAST_ACTIVE', details: { a: 1 } });
  });

  it('strips message and error from a validation failure but keeps errors[]', () => {
    const { status, body } = run(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
        code: 'VALIDATION_FAILED',
        errors: [{ property: 'email', constraints: ['isEmail'] }],
      }),
    );

    expect(status).toBe(400);
    expect(body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      errors: [{ property: 'email', constraints: ['isEmail'] }],
    });
  });

  it.each([
    [new HttpException('x', 401), 'UNAUTHORIZED'],
    [new HttpException('x', 403), 'FORBIDDEN'],
    [new NotFoundException('Cannot GET /nope'), 'NOT_FOUND'],
    [new HttpException('ThrottlerException: Too Many Requests', 429), 'TOO_MANY_REQUESTS'],
  ])('gives a Nest built-in a status-derived code, never its text (%#)', (exception, code) => {
    const { body } = run(exception);

    expect(body.code).toBe(code);
    expect(body).not.toHaveProperty('message');
    expect(body).not.toHaveProperty('error');
  });

  it('keeps the other fields of a structured body, such as the health payload', () => {
    const { status, body } = run(
      new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
        code: 'DATABASE_UNREACHABLE',
      }),
    );

    expect(status).toBe(503);
    expect(body).toEqual({
      statusCode: 503,
      status: 'error',
      database: 'unreachable',
      code: 'DATABASE_UNREACHABLE',
    });
  });

  it('answers an unexpected error with a 500 INTERNAL_ERROR and logs it, leaking nothing', () => {
    const { status, body, log } = run(new Error('connection string postgres://secret'));

    expect(status).toBe(500);
    expect(body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(log).toHaveBeenCalledWith(expect.any(Error));
  });
});
