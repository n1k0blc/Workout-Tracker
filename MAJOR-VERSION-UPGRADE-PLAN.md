# Major-Version Upgrade Plan (2026 round)

Drafted 2026-09-13 for issue #173 (parent: #167). Analysis + decisions for the next batch of major-version bumps surfaced by `pnpm outdated -r`, mirroring the format of `DEPENDENCY-HYGIENE-PLAN.md` (the prior round: Node 22, Next.js, TypeScript 6, pnpm, Prisma 7 — all now shipped). This round is **not security-motivated** (see #170 for the CVE-driven work, already done); it's about staying current before a forced upgrade becomes urgent.

## Baseline (as of 2026-09-13)

| | Current | Latest | Notes |
|---|---|---|---|
| `@nestjs/*` family (10 packages) | 11.x | 12.x | `@nestjs/config` (4.0.4) and `@nestjs/schedule` (6.1.3) jump straight to 12.x too — see below |
| TypeScript | 6.0.3 | 7.0.2 | Both workspaces |
| ESLint (frontend) | 9.39.5 | 10.10.0 | Backend already moved to ESLint 10 in #170 |
| Vitest (frontend) | 4.1.11 | 5.0.0 | |
| `react-datepicker` / `@types/react-datepicker` | 9.1.0 / 6.2.0 | — / 7.0.0 (deprecated) | **Dead dependencies — see below, not a version question at all** |
| Node (local + Docker) | 22.18.0 / `node:22-alpine` | — | Already current from the prior round |
| Backend build | `nest-cli.json`: `webpack: false` (plain `tsc`), CommonJS | — | No bundler in the build path |
| Express (backend) | 5.2.1 | — | Already satisfies NestJS 12's `platform-express` peer (`≥5.1.0`) |
| CI | `.github/workflows/ci.yml`, `pnpm audit` only (#170) | — | Does not run lint/typecheck/tests yet — any bump here still needs manual verification |

## Decisions and rationale

### 1. `@types/react-datepicker` — not a version decision, a deletion

The issue asks for "an explicit call on `@types/react-datepicker`'s deprecated-major situation." Investigated by grepping the entire frontend for `react-datepicker` imports: **zero hits**. The app's actual date-picker component (`components/date-picker.tsx`, used from the profile, register, and workout-history-edit pages) is a plain native `<input type="date">` — it never imported the `react-datepicker` library at all. `react-day-picker` (a *different*, unrelated package, actively used in `components/ui/calendar.tsx` and `middleware.ts`) is what the calendar UI actually runs on.

- **Decision**: Remove `react-datepicker` and `@types/react-datepicker` from `apps/frontend/package.json` entirely. There is no replacement to evaluate because there's nothing to replace — this is dead weight from an earlier iteration of the date-picker UI that never got cleaned up.
- **Risk**: None (build + test suite are the only verification needed — nothing imports either package).
- **Sequencing**: Step 1, immediately, independent of everything else below.

### 2. NestJS 11 → 12 (all 10 packages, backend only)

- **Pros**: Stays current with the framework; `@nestjs/config` 12's rewritten `get()`/`getOrThrow()` catches previously-silent config-key typos at compile time; the official `nest upgrade` codemod automates most of the mechanical changes.
- **Cons**: The `@nestjs/config` (4→12) and `@nestjs/schedule` (6→12) jumps are **mostly version-scheme alignment** with the unified Nest v12 release train, not 8 majors of accumulated breaking history — but not purely cosmetic either: both packages convert to native ESM internally (behind Node's `require(esm)`, so no `"type": "module"` change needed on our side) and drop legacy deep-import paths (`@nestjs/schedule/dist/enums/...`-style imports) — worth a repo-wide grep for deep imports before bumping. `@nestjs/config`'s validation moves from Joi-specific options to a Standard Schema — checked `ConfigModule.forRoot(...)` in `app.module.ts:26`: this repo already passes a custom `validate` function, not a Joi `validationSchema`, so this specific breaking change doesn't apply here at all. Node 21.x is explicitly unsupported (only 20.19+/22.12+) — irrelevant here, we're on 22.18.
- **Risk**: **Low-Medium.** This backend has no webpack/Rspack bundler in the build path (`nest-cli.json`: `webpack: false`, plain `tsc` output) and stays CommonJS, so NestJS 12's default-bundler and ESM-scaffold changes don't touch us. Express is already on 5.2.1, ahead of the 12.x `platform-express` peer floor. Already checked for deep imports into any `@nestjs/*` package's internal paths (`@nestjs/*/dist/...`-style) across `apps/backend/src` — zero hits, so that risk is closed out, not just "greppable."
- **Sequencing**: Step 2 — after the datepicker cleanup, before anything else in this round. Validate via full backend type-check + lint + test suite + a Docker build (per the existing arm64 MacBook Air smoke-test flow), since a NestJS major is exactly the kind of change that can look clean in isolated unit tests but break DI wiring or a decorator's runtime behavior only when the whole app boots.

### 3. Vitest 4 → 5 (frontend only)

- **Pros**: Real perf work (shared Vite server across projects, faster VM pools); `clearMocks: true` becomes the default, which is *safer* (no more accidental mock-state leaking between test cases in the same file) but is a behavior change that needs a real test run to surface, not just a build; hoisted `vi.mock`/`vi.hoisted` misuse now hard-errors instead of silently misbehaving; an unawaited `expect(...).resolves/rejects` now **fails** the test instead of just warning — this could surface a previously-silent bug in an existing spec, which would be a good catch, not a regression.
- **Cons**: Requires Vite ≥6.4.0 and Node ≥22.12 (already satisfied, we're on 22.18). `-t` CLI test-name filtering changes from a single string to a `"suite > test"` space-joined chain — breaks any saved `-t` invocations, though this repo doesn't have any committed in `package.json` scripts. `test.sequential`/`describe.sequential` are removed (replaced by `concurrent: false`) — grepped the frontend test suite, no hits, not a blocker. Checked the `environment: 'node'` vs. `jsdom` question in `apps/frontend/vitest.config.mts`: **not a bug** — the two component tests that actually need a real DOM (`exercise-card-unilateral-edit.test.tsx`, `workout-timer-flutter.test.tsx`) both correctly declare a per-file `// @vitest-environment jsdom` override; the global `node` default is a deliberate speed optimization for the rest of the (pure-logic) suite.
- **Risk**: **Medium** — no blocking incompatibilities found, but the `clearMocks` default flip and stricter async-assertion enforcement mean this needs an actual full test-suite run (not just `tsc`/build) to catch newly-strict failures, plus a manual skim of any test relying on mock state persisting across cases in the same file.
- **Config fix, bundle with this bump regardless of outcome**: `apps/frontend/vitest.config.mts` already prints a forward-compat warning on every run (`Your Vite config uses features that are unsupported by configLoader: 'native'... Use import.meta.dirname instead`). Confirmed this isn't a Vitest-5-specific default flip (`configLoader: 'bundle'` is still the default in v5), but it's a one-line, zero-risk fix worth doing in the same pass since the warning already fires today: `path.resolve(__dirname, '.')` → `path.resolve(import.meta.dirname, '.')`.
- **Sequencing**: Step 3, after NestJS 12 (independent workspace, no shared risk, but sequencing backend-then-frontend keeps each major isolated to one workspace's test run at a time for easy attribution of any failure).

### 4. TypeScript 6.0 → 7.0 (both workspaces) — **deferred, not attempted this round**

- **What 7.0 actually is**: Confirmed this is *not* a normal compiler major — TypeScript 7.0 is the native Go rewrite (the "Corsa"/`typescript-go` project), shipped as a CLI-only binary. **It has no programmatic compiler API in 7.0** — that's deferred to 7.1 (~October 2026). Every tool that imports `typescript` as a library (rather than shelling out to `tsc`) breaks outright, not just "may need a bump":
  - `ts-loader` (used by NestJS's build, though we don't use the webpack path — still a transitive peer)
  - `ts-jest` (backend's Jest transform)
  - `ts-node` (backend's dev/script runner, e.g. `prisma:seed`, the various `migrate:*` scripts)
  - `@typescript-eslint/parser`/`eslint-plugin` (currently 8.70.0, and the underlying issue tracker confirms no released version supports the API-less 7.0 yet)
- **Pros** (of the *idea*, not of doing it now): Real, large compile-time speedups (published benchmarks: 8-12x on full builds) — directly relevant, since this repo previously had to strip an unnecessary `parserOptions.project` from the backend's ESLint config specifically because full-project type-aware parsing is slow (#170). Next.js 16 itself already type-checks fine under native TS 7 (it transpiles via SWC, so the frontend build's *transpilation* path was never dependent on the compiler API — only the separate `tsc --noEmit` type-check step and the test/lint tooling are).
- **Cons**: No supported upgrade path exists yet for this repo's actual toolchain. The only "working" setup today is a fragile dual-compiler alias (keep real `typescript@6.x` under the `typescript` package name for ts-jest/ts-loader/ts-node/eslint, and invoke TS7 under a different package name purely for an extra, isolated `tsc --noEmit` pass) — not worth the complexity for a non-security, non-blocking upgrade.
- **Risk**: **High** (if attempted now) — not from ordinary type-error fallout, but because there is no supported path for the backend's build/test/lint pipeline to run *on* 7.0 at all yet.
- **Decision**: **Defer.** Revisit once TypeScript 7.1 ships (restores the compiler API) *and* `@typescript-eslint`, `ts-jest`, and `ts-node` have each released a version with confirmed 7.x support — realistically a few weeks after 7.1, not immediately. Track via the `typescript-eslint` GitHub issue tracker (search "TypeScript 7" support) rather than guessing a date. Until then, `typescript@6.0.3` remains the pinned dependency in both workspaces; this is not "falling behind," it's waiting for the ecosystem to catch up to an unusually disruptive release.
- **Optional low-risk consolation**: if the compile-time win is wanted sooner, add `@typescript/native-preview` (or equivalent) as an *additional*, isolated `tsc --noEmit`-only check — not a replacement for the workspace `typescript` dependency — purely as an extra fast feedback signal in local dev or CI. Not scoped as part of this plan; flagging as a follow-up idea only.

### 5. ESLint 9 → 10 (frontend only) — **deferred, blocked upstream**

- **Pros**: The frontend's `eslint.config.mjs` is already flat-config (via `eslint-config-next/core-web-vitals` + `/typescript`) — unlike the backend's #170 migration off a dead `.eslintrc.js`, no config-format work is needed here, this would be a pure version bump *if* upstream were ready. `eslint-plugin-react-hooks@7.1.1` (already in use, bundled by `eslint-config-next@16.3.5`) already declares ESLint 10 support in its peer range. `typescript-eslint` (the meta-package `eslint-config-next` pins) already peers on `^10.0.0` too.
- **Cons — this is a hard blocker, not just a risk**: `eslint-config-next@16.3.5` bundles `eslint-plugin-react`, `eslint-plugin-import`, and `eslint-plugin-jsx-a11y`, all of which cap their own `eslint` peer range below 10.x. Verified directly against the GitHub API (2026-09-13): the canonical tracking issue is [vercel/next.js#89764](https://github.com/vercel/next.js/issues/89764) ("`TypeError: contextOrFilename.getFilename is not a function` when running ESLint v10"), **still open**, filed 2026-02-10. A duplicate ([#91702](https://github.com/vercel/next.js/issues/91702)) was closed in favor of it, and its candidate fix PR ([#91710](https://github.com/vercel/next.js/pull/91710)) is **still unmerged and blocked** (`mergeable_state: blocked`), last updated 2026-07-27 — over 7 weeks stale as of this plan. Bumping `eslint` to 10.x today would run three transitive plugins outside their tested/declared peer range; pnpm's non-strict peer resolution wouldn't hard-fail the install, but that's not a green light, just an absence of an install-time guard rail.
- **Risk**: **Blocked** (not "High" — there's nothing to assess risk-wise until the upstream dependency is unblocked).
- **Decision**: **Defer.** Re-check `eslint-config-next`'s bundled plugin peers the next time this repo bumps Next.js, and revisit this bump once vercel/next.js#89764 (or an equivalent fix) ships in a released `eslint-config-next` version — not before.
- **Sequencing note**: since neither TypeScript 7 nor ESLint 10 are proceeding this round, there's no cross-dependency sequencing needed between them for now — revisit both independently when each is unblocked.

## Execution plan

Each step: full type-check + lint + test suite in the affected workspace(s), then the arm64 MacBook Air Docker build-and-smoke-test flow (native, no emulation) before moving to the next step — same discipline as the prior `DEPENDENCY-HYGIENE-PLAN.md` round. Only steps 1-3 are being executed this round; steps 4-5 are tracked as deferred with explicit unblock conditions, not scheduled.

```markdown
## Step 1 — Remove dead date-picker dependencies (independent, no risk)
- [ ] Remove `react-datepicker` and `@types/react-datepicker` from apps/frontend/package.json
- [ ] `pnpm install`, confirm frontend build + test suite still pass (nothing imports either package)

## Step 2 — NestJS 11 -> 12 (backend only, low-medium risk)
- [ ] Bump all 10 `@nestjs/*` packages to their 12.x releases (common, core, config, jwt, passport, platform-express, schedule, schematics, testing, cli)
- [ ] Run the official `nest upgrade` codemod, review its diff (the Standard Schema validation change doesn't apply here — `app.module.ts:26` already uses a custom `validate` function, not Joi)
- [ ] Full backend type-check + lint + test suite
- [ ] Build the backend Docker image on the MacBook Air (arm64, native), `docker compose up`, verify `/api/health` and a full login/workout/nutrition smoke pass

## Step 3 — Vitest 4 -> 5 (frontend only, medium risk)
- [ ] Fix `apps/frontend/vitest.config.mts`: `path.resolve(__dirname, '.')` -> `path.resolve(import.meta.dirname, '.')`
- [ ] Bump `vitest` to 5.0.0
- [ ] Full frontend test suite -- read the diff of any newly-failing test carefully before patching (the `clearMocks: true` default and stricter unawaited-assertion enforcement are both more likely to reveal real bugs than to be false positives)
- [ ] Frontend build + manual smoke pass in the browser

## Deferred (explicit revisit conditions, not scheduled)
- [ ] TypeScript 6 -> 7: revisit once 7.1 ships (restores the compiler API) AND @typescript-eslint/ts-jest/ts-node each confirm 7.x support -- track typescript-eslint's issue tracker, don't guess a date
- [ ] ESLint 9 -> 10 (frontend): revisit once eslint-config-next ships a release with updated eslint-plugin-import(-x)/react/jsx-a11y peers -- track vercel/next.js#89764, re-check on the next Next.js bump regardless
```
