# 9. API errors carry a code and structured details, never a message

Date: 2026-10-03

## Status

Accepted

## Context

The API threw ~110 exceptions with a human-readable `message` — a mix of German (`Eintrag nicht
gefunden`) and English (`Cycle not found`) — shipped to the same users. #178 added a stable
`code` beside the message (expand), #190 made the frontend render the catalogue text for the
code instead of the message (migrate). The message was then dead weight that could only mislead:
nothing displays it, and it keeps the inconsistency alive.

## Decision

**An error response is `{ statusCode, code, details?, errors? }` and nothing human-readable.**

- `ApiExceptionFilter` (`common/errors/api-exception.filter.ts`) is the one place the body is
  shaped. It drops `message` and Nest's English `error` phrase from every `HttpException`, keeps
  the other structured fields (the health check's payload, validation `errors`), and gives a
  Nest built-in that carries no code a status-derived one (`UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `TOO_MANY_REQUESTS`). An unexpected error is logged server-side and answered as a
  bare `500 INTERNAL_ERROR` — its text can no longer leak.
- `App*Exception` takes `(code, details?)`. **`details` are the message's parameters, values
  only, never prose**: the weekday that is taken, the sum that was wrong, the set number. The
  frontend fills them into the catalogue text (`ApiErrors.codes.<CODE>`), naming a weekday in the
  user's locale.
- Validation failures are `{ code: 'VALIDATION_FAILED', errors: [{ property, constraints }] }`;
  the generated `message: string[]` is gone, and so are the DTO `message:` options that fed it.
- Backend tests assert on `code` (and `details`) only.

This is a breaking API change, deliberately taken now: production has one user, so the cost is a
single coordinated frontend + backend release. Anything else that read `message` off an error
response breaks.

## Consequences

Language can no longer be reintroduced through an exception: there is no field to put it in.
Adding a code means adding a `de` and `en` catalogue entry — a frontend test iterates the
backend's `ERROR_CODES` and fails otherwise.

Plain `throw new Error(...)` inside the backend (a wiring bug, a seed script) is not an API
error: it becomes a bare 500 and its text is logged, not sent.
