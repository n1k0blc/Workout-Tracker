---
name: post-commit-security-check
description: Check a just-made commit (or range) against the project's security checklist — secrets, input sanitization, ownership checks, rate limiting, auth, CORS/headers, dependencies. Run by hand right after committing, before pushing or deploying.
disable-model-invocation: true
---

# Post-commit security check

Diff-scoped, not repo-wide: this catches a *new* violation the commit just introduced. It does not re-audit code the commit didn't touch — that's a full audit (see [#167](https://github.com/n1k0blc/Workout-Tracker/issues/167) for the last one), a different and heavier task.

## 1. Scope the diff

Default range is `HEAD~1..HEAD` (the last commit). If the user names a different commit, range, or branch, use that instead.

Run `git diff <range> --stat` then `git diff <range>` for the full patch. Read every changed file's hunks — skip nothing, including test files and config.

**Done when:** you have the full diff text in hand, not just the file list.

## 2. Check the diff against every rule below

Go rule by rule. For each, ask only: *does this diff introduce a violation?* Pre-existing code that already had the issue before this commit is out of scope here.

### Secrets
- No API key, token, password, or connection string appears as a literal string in any added/changed line — frontend (`apps/frontend`) or backend (`apps/backend`).
- No new `.env*` file got added to git tracking (check `git diff <range> --stat` for a path under an `.env` pattern that isn't `.env.production.example`).

### Input handling
- No new `dangerouslySetInnerHTML`, `innerHTML =`, or equivalent raw-HTML render of a value that traces back to user input.
- No new `$queryRaw` / `$executeRaw` (or raw SQL string) built with interpolated/concatenated user input. Prisma's query builder is the norm here — a new raw query is a flag even if parameterized, unless it's clearly justified.
- Any new user-facing input field (form, query param, request body) has server-side validation (a DTO/class-validator decorator, a Zod schema, or equivalent) — not just a frontend check.
- Any new file-upload handling validates type and size server-side, not by trusting the extension or client-declared MIME type.

### Ownership / access control
This is the load-bearing check in the whole list. The app has no Postgres RLS — isolation is enforced entirely in application code, by choice (see [#167](https://github.com/n1k0blc/Workout-Tracker/issues/167): RLS was evaluated and declined). That means there is no database-level backstop if a service method forgets the check — this rule *is* the only enforcement, not a defense-in-depth layer on top of one.

- Any new or changed service method that reads or writes user-owned data (workouts, meals, foods, favorites, exercises, etc.) filters by the authenticated `userId` — same pattern as the existing services. A method that takes an ID from the request and queries by that ID alone, without also constraining on the requester's `userId`, is a violation.
- **A brand-new service file is the highest-stakes case**: check *every* CRUD method it defines, not just the one the commit's diff emphasizes — a new service with even one unfiltered method is a full cross-user data leak on that resource, not a partial one.
- If the method (or service) is new, a cross-user access test exists for it (or is added in this same commit) — see the pattern in `foods.service.spec.ts`, `meal-slots.service.spec.ts`, `diary-entries.service.spec.ts`. A new service with no ownership test is a fail on its own, independent of whether the code looks correct on read.

### Rate limiting
- Any new public/authenticated API endpoint sits under the global `ThrottlerGuard` (the default) or, if it's auth-related (login, refresh, register, password reset), carries an explicit `@Throttle` decorator with a tighter limit than the default — matching `auth.controller.ts`'s existing pattern.

### Auth & authorization
- Any new API route that touches user data is behind the JWT auth guard — not reachable unauthenticated unless that's a deliberate, reviewed choice (e.g. a public health check).
- A route being authenticated is not treated as sufficient by itself — check it also verifies the caller is *authorized* for the specific resource (ties back to the ownership check above).

### CORS & headers
- No change loosens `CORS_ORIGIN` handling toward a wildcard (`*`) or an unvalidated origin.
- No change to `next.config.ts` or `middleware.ts` removes or weakens an existing security header (CSP, `X-Content-Type-Options`, `X-Frame-Options`) without a stated reason in the commit message.

### Dependencies
- Any new dependency in a `package.json` is one you'd recognize — not something an AI suggested that doesn't match a package you already know you meant to add. If unfamiliar, its npm page and download count got checked before landing here (typosquats are usually near-zero-download near-lookalikes).
- If a new dependency was added, `pnpm audit` was run since (mention this to the user if you can't verify it yourself in this pass).

### Deployment hygiene
- No debug flag, verbose-error toggle, or `NODE_ENV` bypass got flipped on for a non-development environment.
- No test/demo/debug route got added outside of clearly-named test files.

## 3. Report

For each rule above: state pass, or fail with the exact file:line and a one-line description of the violation. Don't report rules that are simply not applicable to this diff (e.g. no new dependency was added) — omit them rather than padding the report with N/As.

If everything passes, say so plainly — don't manufacture a finding to seem thorough.

**Done when:** every rule above has been checked against every changed hunk in the diff, and the report lists every genuine violation found.
