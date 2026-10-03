import { HttpStatus } from '@nestjs/common';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppInternalServerErrorException,
  AppNotFoundException,
  AppUnauthorizedException,
} from './app-exceptions';

/**
 * The contract half of the error-code migration (#191): an exception is a status, a `code`, and
 * optional structured `details` -- no human-readable text, in any language.
 */
describe('App*Exception (issues #178, #191)', () => {
  it('carries a code and no prose in its response body', () => {
    const exception = new AppNotFoundException('CYCLE_NOT_FOUND');

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toEqual({ code: 'CYCLE_NOT_FOUND' });
    expect(exception.code).toBe('CYCLE_NOT_FOUND');
  });

  it('adds structured details when the condition has parameters', () => {
    const exception = new AppBadRequestException('EXERCISE_MUSCLE_PERCENTAGES_INVALID_SUM', {
      sum: 90,
    });

    expect(exception.getResponse()).toEqual({
      code: 'EXERCISE_MUSCLE_PERCENTAGES_INVALID_SUM',
      details: { sum: 90 },
    });
    expect(exception.details).toEqual({ sum: 90 });
  });

  it.each([
    [AppNotFoundException, HttpStatus.NOT_FOUND] as const,
    [AppBadRequestException, HttpStatus.BAD_REQUEST] as const,
    [AppConflictException, HttpStatus.CONFLICT] as const,
    [AppUnauthorizedException, HttpStatus.UNAUTHORIZED] as const,
    [AppForbiddenException, HttpStatus.FORBIDDEN] as const,
    [AppInternalServerErrorException, HttpStatus.INTERNAL_SERVER_ERROR] as const,
  ])('%p keeps its HTTP status', (ExceptionClass, status) => {
    const exception = new ExceptionClass('CYCLE_NOT_FOUND');
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toEqual({ code: 'CYCLE_NOT_FOUND' });
  });
});
