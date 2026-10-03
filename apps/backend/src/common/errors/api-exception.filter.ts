import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ErrorCode } from './error-codes';

/** The code for an exception that carries none -- Nest built-ins (guards, throttler, routing). */
const STATUS_CODES: Record<number, ErrorCode> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'TOO_MANY_REQUESTS',
};

/**
 * The one place an API error body is shaped (#191). It carries `statusCode`, a `code`, and
 * whatever structured fields the exception added (`details`, validation `errors`) -- but never
 * `message` or `error`, which Nest fills with English prose. An exception that did not come
 * from our code gets a status-derived code so the client always has something to map; an
 * unexpected error is logged here (Nest's default filter did that) and answered as a bare 500.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  constructor(private readonly logUnexpected: (error: unknown) => void = (e) => this.log(e)) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (!(exception instanceof HttpException)) {
      this.logUnexpected(exception);
      response.status(500).json({ statusCode: 500, code: 'INTERNAL_ERROR' satisfies ErrorCode });
      return;
    }

    const status = exception.getStatus();
    const raw = exception.getResponse();
    const {
      message: _message,
      error: _error,
      ...rest
    } = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

    response.status(status).json({
      statusCode: status,
      ...rest,
      code:
        rest.code ?? STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
    });
  }

  private log(error: unknown): void {
    this.logger.error(error instanceof Error ? error.stack : String(error));
  }
}
