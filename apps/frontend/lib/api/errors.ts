/** One failing request property and the class-validator constraint names it broke (#190). */
export interface FieldError {
  property: string;
  constraints: string[];
}

/**
 * A non-2xx API response. The API sends no human-readable text (#191): the user-facing message is
 * `code` (or a validation `errors` entry) looked up in the message catalogue
 * (`useApiErrorMessage`), with `details` as its parameters. `message` is only the code, for logs.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors: FieldError[] = [],
    public readonly details: Record<string, string | number> = {},
  ) {
    super(code ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }

  /** From a parsed error body -- tolerant of a missing or malformed one. */
  static fromBody(status: number, body: unknown): ApiError {
    const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    return new ApiError(
      status,
      typeof b.code === 'string' ? b.code : undefined,
      Array.isArray(b.errors) ? b.errors : [],
      typeof b.details === 'object' && b.details !== null
        ? (b.details as Record<string, string | number>)
        : {},
    );
  }
}
