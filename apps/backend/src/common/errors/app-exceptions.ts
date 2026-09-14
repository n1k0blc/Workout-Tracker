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
 * Drop-in replacements for Nest's built-in HTTP exceptions that also carry a machine-readable
 * `code` (#178). `getResponse()` is the only override: it defers to the built-in class for the
 * exact `{ message, error, statusCode }` body Nest has always produced from a string message,
 * then adds `code` on top -- the expand half of an expand-contract migration, so the response
 * shape existing frontend code already reads (`message`) is byte-for-byte unchanged.
 */
function withCode(body: string | object, code: ErrorCode): object {
  return { ...(typeof body === 'object' && body !== null ? body : { message: body }), code };
}

export class AppNotFoundException extends NotFoundException {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
  }
  override getResponse() {
    return withCode(super.getResponse(), this.code);
  }
}

export class AppBadRequestException extends BadRequestException {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
  }
  override getResponse() {
    return withCode(super.getResponse(), this.code);
  }
}

export class AppConflictException extends ConflictException {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
  }
  override getResponse() {
    return withCode(super.getResponse(), this.code);
  }
}

export class AppUnauthorizedException extends UnauthorizedException {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
  }
  override getResponse() {
    return withCode(super.getResponse(), this.code);
  }
}

export class AppForbiddenException extends ForbiddenException {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
  }
  override getResponse() {
    return withCode(super.getResponse(), this.code);
  }
}

export class AppInternalServerErrorException extends InternalServerErrorException {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
  }
  override getResponse() {
    return withCode(super.getResponse(), this.code);
  }
}
