import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode } from './error-codes';

/**
 * Structured parameters of an error condition (the weekday that is taken, the sum that was
 * wrong). Values only -- never prose, so no language can leak back into the API.
 */
export type ErrorDetails = Record<string, string | number>;

/**
 * Drop-in replacements for Nest's built-in HTTP exceptions that carry a machine-readable `code`
 * (#178) and nothing human-readable (#191): the client maps the code to text in the user's
 * locale. The response body is `{ code, details? }`; `ApiExceptionFilter` adds `statusCode`.
 */
export class AppNotFoundException extends NotFoundException {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: ErrorDetails,
  ) {
    super({ code, details });
  }
}

export class AppBadRequestException extends BadRequestException {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: ErrorDetails,
  ) {
    super({ code, details });
  }
}

export class AppConflictException extends ConflictException {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: ErrorDetails,
  ) {
    super({ code, details });
  }
}

export class AppUnauthorizedException extends UnauthorizedException {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: ErrorDetails,
  ) {
    super({ code, details });
  }
}

export class AppForbiddenException extends ForbiddenException {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: ErrorDetails,
  ) {
    super({ code, details });
  }
}

export class AppInternalServerErrorException extends InternalServerErrorException {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: ErrorDetails,
  ) {
    super({ code, details });
  }
}
