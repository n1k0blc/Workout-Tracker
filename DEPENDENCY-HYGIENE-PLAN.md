# Dependency & Tooling Hygiene Plan

Drafted 2026-07-07. Analysis + decisions from a planning session covering Prisma, package manager, monorepo tooling, and general dependency hygiene for the NestJS/Prisma backend + Next.js frontend, self-hosted on a Raspberry Pi 5 (ARM64).

## Baseline (as of 2026-07-07)

| | Current | Notes |
|---|---|---|
| Repo shape | npm workspaces monorepo already (`apps/backend`, `apps/frontend`, unused `packages/*`) | Not "heading toward" one — already there |
| Local Node | v22.18.0 / npm 11.5.2 | Maintenance LTS, fine to ~2027-04 |
| Docker base image | `node:20-alpine` (both Dockerfiles) | Past EOL since 2026-04 |
| `npm audit` (backend) | 0 vulnerabilities | Prisma bump is not CVE-driven |
| `npm audit` (root/frontend) | 2 vulns: Next.js 16.2.1 (1 high, 1 moderate) | Fixed in 16.2.10, patch-level |
| Prisma / @prisma/client | 6.19.3 → latest 7.8.0 | Major, breaking |
| TypeScript | 5.9.3 → 6.0.3 (both workspaces) | Major |
| date-fns | 3.6.0 → 4.4.0 (frontend) | Major |
| `@types/node` | frontend `^20`, backend `^25` | Mismatched to actual Node 22 runtime either way |
| Deploy | `deploy.sh` runs `docker compose build --no-cache` on the Pi itself, every deploy | Full fresh install every time, unrelated to npm/pnpm |
| CI | None active (`.github/workflows/deploy.yml.example` unused) | Blast radius of tooling changes = 2 Dockerfiles only |
| Validation env | MacBook Air, Apple Silicon | Same arm64 arch as Pi 5 — real pre-prod signal, not emulated |

## Decisions and rationale

### 1. Docker base image: `node:20-alpine` → `node:22-alpine`
- **Pros**: closes an active EOL/unpatched-runtime gap; matches local dev exactly; zero code changes.
- **Cons**: none identified.
- **Risk**: Low. **Sequencing**: Step 1 (first).

### 2. Next.js 16.2.1 → 16.2.10
- **Pros**: closes multiple high/moderate CVEs (DoS, XSS, cache poisoning, SSRF); patch-level, no breaking changes expected.
- **Cons**: none.
- **Risk**: Low. **Sequencing**: bundled with Step 1.

### 3. `deploy.sh` `--no-cache` removal
- **Pros**: restores Docker layer caching (Dockerfiles already `COPY package*.json` before source) — skips redundant installs on deploys where deps didn't change; directly addresses the SD-wear/deploy-time pain, independent of npm vs. pnpm.
- **Cons**: if `--no-cache` was masking a stale-layer bug, removing it could resurface it; origin unknown.
- **Risk**: Low, but unverified reasoning. **Sequencing**: Step 2 (independent of everything else; benefits every later Pi deploy).

### 4. `@types/node` realignment to `^22` (both workspaces)
- **Pros**: types match actual runtime; trivial one-line-per-workspace change.
- **Cons**: none.
- **Risk**: Low. **Sequencing**: bundled with Step 3.

### 5. TypeScript 5.9 → 6.0 (both workspaces)
- **Pros**: current on compiler, ahead of eventual forced upgrade.
- **Cons**: major compiler bump can surface new type errors across both codebases independently (not shared, so double the surface); not security-driven.
- **Risk**: Medium. **Sequencing**: Step 3, validated via type-check + test suite + Docker build in each workspace.

### 6. date-fns 3 → 4 (frontend)
- **Pros**: current, avoids future forced bump.
- **Cons**: v4 changed API surface in places; needs manual verification since date formatting is user-visible (workout history, calendars).
- **Risk**: Medium. **Sequencing**: Step 4, requires manual smoke-testing of date displays after the bump, not just a build check.

### 7. npm → pnpm (both workspaces, both Dockerfiles)
- **Pros**: stricter resolution catches phantom dependencies; better disk efficiency for local dev.
- **Cons**: pnpm blocks native postinstall scripts by default — `bcrypt`, `argon2`, and Prisma's engine download all need explicit allow-listing (`pnpm.onlyBuiltDependencies`) or they silently fail; `overrides.multer` needs migrating to pnpm's override syntax; lockfile conversion via `pnpm import` needs a resolved-tree diff check; ARM compatibility is a non-issue (pnpm is pure JS).
- **Risk**: Medium (mostly the silent postinstall-script trap). **Sequencing**: Step 5, before Prisma 7 so Prisma 7's driver-adapter work happens on an already-stable package manager.

### 8. Prisma 6 → 7
- **Pros**: current on major version; driver adapters are the forward direction for Prisma.
- **Cons**: not CVE-driven (audit clean on 6.19.3); requires driver adapters for all DBs (`@prisma/adapter-pg`), a new `prisma.config.ts` replacing schema-embedded config, and a generator change (`prisma-client` instead of `prisma-client-js`) that breaks the current Dockerfile's `COPY --from=builder /app/node_modules/.prisma` step — the client no longer generates into `node_modules` by default, so the multi-stage COPY needs rework.
- **Risk**: High — the riskiest item in this round, and the only one that forces a real Dockerfile redesign rather than a version-string bump.
- **Sequencing**: Step 6 (last), so base image/package manager are already stable when this is the one remaining variable.

### 9. Turborepo/Turbopack — skipped
No shared `packages/*` code planned, so there's no task graph for it to cache; the Pi deploy path (`docker compose build`) never invokes root-level scripts anyway, so it wouldn't reach production even if adopted.

## Execution plan

Each step: build the arm64 image on the MacBook Air (native, no emulation), `docker compose up`, hit `/api/health` and the frontend, manually exercise the golden path — before starting the next step. Only after all steps pass locally does anything go to the Pi.

```markdown
## Step 1 — Runtime + security patch (bundle, low risk)
- [ ] Bump node:20-alpine -> node:22-alpine in apps/backend/Dockerfile and apps/frontend/Dockerfile
- [ ] Bump next 16.2.1 -> 16.2.10 (and eslint-config-next to match) in apps/frontend
- [ ] Build both images on MacBook Air (arm64), docker compose up, verify /api/health + frontend load

## Step 2 — Deploy script fix (independent, low risk)
- [ ] Remove --no-cache from deploy.sh's docker compose build
- [ ] Confirm a no-op deploy (no dep changes) actually skips the npm ci layer

## Step 3 — Compiler/types (medium risk, both workspaces)
- [ ] Bump typescript 5.9 -> 6.0 in apps/backend and apps/frontend
- [ ] Realign @types/node to ^22 in both workspaces
- [ ] Run full type-check + lint + test suite in each workspace
- [ ] Build both images on MacBook Air, smoke test

## Step 4 — date-fns major (medium risk, frontend only)
- [ ] Bump date-fns 3.6.0 -> 4.4.0
- [ ] Fix any import/API breaks surfaced by build
- [ ] Manually verify date-rendering surfaces in the running app (workout history, calendar views, PR dates)

## Step 5 — Package manager migration (medium risk, both Dockerfiles)
- [ ] Convert package-lock.json -> pnpm-lock.yaml via pnpm import, diff resolved versions
- [ ] Migrate root overrides.multer to pnpm's override syntax
- [ ] Add pnpm.onlyBuiltDependencies allow-list for bcrypt, argon2, @prisma/client (and @prisma/engines) - verify native builds actually run
- [ ] Update both Dockerfiles: npm ci --workspace=X -> pnpm install --filter=X
- [ ] Build both images on MacBook Air, smoke test

## Step 6 — Prisma major (highest risk, backend only, last)
- [ ] Add @prisma/adapter-pg driver adapter, wire into PrismaService
- [ ] Introduce prisma.config.ts (datasource URL, migrations, seed path)
- [ ] Update generator to prisma-client with explicit output path
- [ ] Rework apps/backend/Dockerfile's multi-stage COPY for the new client output location
- [ ] Run prisma migrate + full backend test suite locally
- [ ] Build image on MacBook Air, smoke test full API surface incl. DB-touching endpoints

## Deploy
- [ ] Only after all 6 steps pass locally: git push, deploy.sh on the Pi, verify health checks
- [ ] Keep previous Docker image tags available for rollback until Pi deploy is confirmed stable
```
