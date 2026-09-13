# Major-Version Upgrade Plan (2026 round)

Drafted 2026-09-13 for issue #173 (parent: #167). Analysis + decisions for the next batch of major-version bumps surfaced by `pnpm outdated -r`, mirroring the format of `DEPENDENCY-HYGIENE-PLAN.md` (the prior round: Node 22, Next.js, TypeScript 6, pnpm, Prisma 7 — all now shipped). This round is **not security-motivated** (see #170 for the CVE-driven work, already done); it's about staying current before a forced upgrade becomes urgent.

## Baseline (as of 2026-09-13)

| | Current | Latest | Notes |
|---|---|---|---|
| `@nestjs/*` family (10 packages) | 11.x | 12.x | Attempted and reverted (2026-09-13) — 12.x is pure ESM, breaks this repo's CommonJS Jest setup outright, see below |
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

### 2. NestJS 11 → 12 (all 10 packages, backend only) — **attempted, reverted: blocks the test suite**

- **Pros**: Stays current with the framework; `@nestjs/config` 12's rewritten `get()`/`getOrThrow()` catches previously-silent config-key typos at compile time.
- **Cons found during the original planning pass**: The `@nestjs/config` (4→12) and `@nestjs/schedule` (6→12) jumps are mostly version-scheme alignment with the unified Nest v12 release train, not 8 majors of history; no Joi validation to migrate (`app.module.ts:26` already uses a custom `validate` function); zero deep `@nestjs/*` imports in this codebase; Express already satisfies the 12.x `platform-express` peer floor.
- **Cons found only by actually attempting the bump — the real blocker**: `@nestjs/common`/`@nestjs/core` 12.x are published as **pure ESM** (`"type": "module"` in their own `package.json`, confirmed directly). This repo's Jest setup is CommonJS (`ts-jest`, no `"type": "module"`, no ESM transform config), and Jest's `require()` of a `"type": "module"` package throws `Must use import to load ES Module` — not a type error, a hard runtime failure at test-collection time. Attempting the bump broke **26 of 40 backend test suites** outright (145/505 tests still ran, the rest never loaded). This is not specific to a misconfiguration in this repo: the `@nestjs/throttler` maintainer who verified NestJS-12 compatibility for that package hit and documented the identical failure independently when trial-upgrading their own CommonJS+Jest devDependencies (`nestjs/throttler#2669`), and deliberately did *not* include that half of the upgrade in their fix for exactly this reason.
- **A secondary, already-solved issue along the way**: `@nestjs/throttler@6.5.0` (used here for login/register rate-limiting, not itself in the issue's 10-package list) still declares a peer range capped at `^11.0.0`. The widened-range fix is merged upstream (`nestjs/throttler#2670`, merged 2026-09-03) and independently verified against a live Nest 12.0.1 app by its author (`ThrottlerGuard` still returns the expected `429`/`Retry-After`), but not yet published to npm — the package's release pipeline is separately blocked (`nestjs/throttler#2669`/`#2532`). This alone would have been a `pnpm-workspace.yaml` `peerDependencyRules.allowedVersions` entry, not a blocker — solved and then reverted along with everything else once the Jest/ESM problem surfaced.
- **Risk**: **High, not Low-Medium as originally assessed.** The version-compatibility risk was genuinely low; the toolchain-compatibility risk (Jest can't load an ESM-only Nest) was missed by the original research pass and only surfaced by actually running the test suite after the bump.
- **Decision**: **Reverted, not proceeding this round.** Real options going forward, none attempted yet: (a) migrate the backend's Jest config to support `require(esm)`/ESM transforms (a real, bounded piece of work, not a one-line fix — `ts-jest`'s ESM preset plus `NODE_OPTIONS=--experimental-vm-modules` is the usual path, would need its own verification pass); (b) wait for Node 24.9+, where Jest supports `require(esm)` natively per Jest's own error message — a Node major bump of its own, unplanned; (c) wait for `@nestjs/*` or the wider Jest/ts-jest ecosystem to close this gap some other way. Needs a maintainer decision on which path (if any) to invest in — not a "wait a few weeks" item like TypeScript 7/ESLint 10, since nothing here is scheduled to change on its own.
- **Sequencing**: N/A until a path above is chosen.

### 3. Vitest 4 → 5 (frontend only)

- **Pros**: Real perf work (shared Vite server across projects, faster VM pools); `clearMocks: true` becomes the default, which is *safer* (no more accidental mock-state leaking between test cases in the same file) but is a behavior change that needs a real test run to surface, not just a build; hoisted `vi.mock`/`vi.hoisted` misuse now hard-errors instead of silently misbehaving; an unawaited `expect(...).resolves/rejects` now **fails** the test instead of just warning — this could surface a previously-silent bug in an existing spec, which would be a good catch, not a regression.
- **Cons**: Requires Vite ≥6.4.0 and Node ≥22.12 (already satisfied, we're on 22.18). `-t` CLI test-name filtering changes from a single string to a `"suite > test"` space-joined chain — breaks any saved `-t` invocations, though this repo doesn't have any committed in `package.json` scripts. `test.sequential`/`describe.sequential` are removed (replaced by `concurrent: false`) — grepped the frontend test suite, no hits, not a blocker. Checked the `environment: 'node'` vs. `jsdom` question in `apps/frontend/vitest.config.mts`: **not a bug** — the two component tests that actually need a real DOM (`exercise-card-unilateral-edit.test.tsx`, `workout-timer-flutter.test.tsx`) both correctly declare a per-file `// @vitest-environment jsdom` override; the global `node` default is a deliberate speed optimization for the rest of the (pure-logic) suite.
- **Risk**: **Medium** — no blocking incompatibilities found, but the `clearMocks` default flip and stricter async-assertion enforcement mean this needs an actual full test-suite run (not just `tsc`/build) to catch newly-strict failures, plus a manual skim of any test relying on mock state persisting across cases in the same file.
- **Config fix, bundle with this bump regardless of outcome**: `apps/frontend/vitest.config.mts` already prints a forward-compat warning on every run (`Your Vite config uses features that are unsupported by configLoader: 'native'... Use import.meta.dirname instead`). Confirmed this isn't a Vitest-5-specific default flip (`configLoader: 'bundle'` is still the default in v5), but it's a one-line, zero-risk fix worth doing in the same pass since the warning already fires today: `path.resolve(__dirname, '.')` → `path.resolve(import.meta.dirname, '.')`.
- **Sequencing**: Independent of NestJS 12 (separate workspace, no shared risk) — done and committed (2026-09-13) on its own once the NestJS attempt was reverted.

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

Each step: full type-check + lint + test suite in the affected workspace(s), then the arm64 MacBook Air Docker build-and-smoke-test flow (native, no emulation) before moving to the next step — same discipline as the prior `DEPENDENCY-HYGIENE-PLAN.md` round.

```markdown
## Step 1 — Remove dead date-picker dependencies (independent, no risk) — DONE (2026-09-13)
- [x] Remove `react-datepicker` and `@types/react-datepicker` from apps/frontend/package.json
- [x] `pnpm install`, confirm frontend build + test suite still pass (nothing imports either package)

## Step 2 — NestJS 11 -> 12 (backend only) — ATTEMPTED AND REVERTED (2026-09-13)
- [x] Bump all 10 `@nestjs/*` packages to their 12.x releases
- [x] Add a pnpm peerDependencyRules entry for @nestjs/throttler's stale peer range (solved, reverted along with everything else)
- [x] Full backend type-check + lint + test suite -- **26 of 40 suites failed**: @nestjs/common@12/@nestjs/core@12 are pure ESM (`"type": "module"`), and this repo's CommonJS ts-jest setup cannot `require()` them at all (`Must use import to load ES Module`)
- [x] Reverted the bump; working tree confirmed clean, all 505 tests passing again
- [ ] Not attempted: choosing and executing a path to make Jest able to load an ESM-only Nest (see the decision above) -- blocked on a maintainer choice, not scheduled

## Step 3 — Vitest 4 -> 5 (frontend only) — DONE (2026-09-13)
- [x] Fix `apps/frontend/vitest.config.mts`: `path.resolve(__dirname, '.')` -> `path.resolve(import.meta.dirname, '.')`
- [x] Bump `vitest` to 5.0.0
- [x] Full frontend test suite -- 292/292 pass unchanged, no `clearMocks`/async-assertion fallout
- [x] Frontend build succeeds; lint unchanged (same 79 pre-existing problems, nothing new)

## Deferred (explicit revisit conditions, not scheduled)
- [ ] NestJS 11 -> 12: revisit once a decision is made on how to make this repo's Jest setup able to load ESM-only `@nestjs/*` packages (ts-jest's ESM preset + `NODE_OPTIONS=--experimental-vm-modules`, or waiting for Node 24.9+ where Jest supports `require(esm)` natively) -- not a "wait a few weeks" item, needs a maintainer decision on which path to invest in
- [ ] TypeScript 6 -> 7: revisit once 7.1 ships (restores the compiler API) AND @typescript-eslint/ts-jest/ts-node each confirm 7.x support -- track typescript-eslint's issue tracker, don't guess a date
- [ ] ESLint 9 -> 10 (frontend): revisit once eslint-config-next ships a release with updated eslint-plugin-import(-x)/react/jsx-a11y peers -- track vercel/next.js#89764, re-check on the next Next.js bump regardless
```
