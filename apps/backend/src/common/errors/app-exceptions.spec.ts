import { HttpStatus, NotFoundException } from '@nestjs/common';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppInternalServerErrorException,
  AppNotFoundException,
  AppUnauthorizedException,
} from './app-exceptions';

describe('App*Exception (issue #178)', () => {
  it('adds code to the response body without disturbing message/error/statusCode', () => {
    const exception = new AppNotFoundException('Cycle not found', 'CYCLE_NOT_FOUND');

    expect(exception.getResponse()).toEqual({
      message: 'Cycle not found',
      error: 'Not Found',
      statusCode: HttpStatus.NOT_FOUND,
      code: 'CYCLE_NOT_FOUND',
    });
  });

  it('keeps the exact body a plain NotFoundException would have produced, plus code', () => {
    const plain = new NotFoundException('Cycle not found');
    const withCode = new AppNotFoundException('Cycle not found', 'CYCLE_NOT_FOUND');

    expect(withCode.getResponse()).toEqual({
      ...(plain.getResponse() as object),
      code: 'CYCLE_NOT_FOUND',
    });
  });

  it('preserves getStatus() and message from the underlying Nest exception class', () => {
    const exception = new AppNotFoundException('Cycle not found', 'CYCLE_NOT_FOUND');
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.message).toBe('Cycle not found');
    expect(exception.code).toBe('CYCLE_NOT_FOUND');
  });

  it.each([
    [AppBadRequestException, HttpStatus.BAD_REQUEST, 'Bad Request'] as const,
    [AppConflictException, HttpStatus.CONFLICT, 'Conflict'] as const,
    [AppUnauthorizedException, HttpStatus.UNAUTHORIZED, 'Unauthorized'] as const,
    [AppForbiddenException, HttpStatus.FORBIDDEN, 'Forbidden'] as const,
    [
      AppInternalServerErrorException,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal Server Error',
    ] as const,
  ])('%p produces the matching status/error/code', (ExceptionClass, status, error) => {
    const exception = new ExceptionClass('some message', 'CYCLE_NOT_FOUND');
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toEqual({
      message: 'some message',
      error,
      statusCode: status,
      code: 'CYCLE_NOT_FOUND',
    });
  });
});
