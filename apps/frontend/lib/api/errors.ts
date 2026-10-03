/** One failing request property and the class-validator constraint names it broke (#190). */
export interface FieldError {
  property: string;
  constraints: string[];
}

/**
 * A non-2xx API response. `message` is the server's text, kept so logs and legacy callers
 * still read what they always did -- but no UI path should render it: the user-facing text is
 * `code` (or a validation `errors` entry) looked up in the message catalogue
 * (`useApiErrorMessage`, #190).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
