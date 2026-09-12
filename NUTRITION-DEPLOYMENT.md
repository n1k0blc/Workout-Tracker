# Deployment-Handbuch: Ernährungstracking (Epic #139)

Deployment guide for the nutrition feature on the Raspberry Pi 5. Written for the
`nutrition-feature` branch as of 2026-09-12 (`de28a08`).

This is **not** an ordinary code deploy. It has four phases that must run in order:

| # | Phase | Where | Automated? | Est. duration |
|---|---|---|---|---|
| A | Code + 7 schema migrations | Pi, `./deploy.sh` | yes (container runs `migrate deploy`) | ~10–15 min |
| B | Seed: 289 Lebensmittel (+115 Übungen) | **Mac**, via SSH tunnel | no | ~1 min |
| C | Open-Food-Facts bulk import, ~180k rows | **Mac**, via SSH tunnel | no | 30–90 min (see C.4) |
| D | Daily OFF delta-sync cron | Pi, `./install-off-sync-cron.sh` | no | ~5 min |

Phases B and C are **data scripts** and therefore run from the Mac through an SSH tunnel,
never inside the production container — the production image installs `--prod` dependencies
only, so there is no `ts-node` in it. Phase D is the one script that *does* run in the
container, because it is compiled into `dist/` for exactly that reason.

Sources: epic #139 and its sub-issues #140–#155, in particular the deployment notes on
[#139](https://github.com/n1k0blc/Workout-Tracker/issues/139#issuecomment-5586994781),
[#146](https://github.com/n1k0blc/Workout-Tracker/issues/146#issuecomment-5586642099) and
[#150](https://github.com/n1k0blc/Workout-Tracker/issues/150#issuecomment-5602521258),
plus the `deployment-raspberry-pi` skill.

---

## 0. Before you start: which branch does the Pi pull?

`deploy.sh` line 82 runs `git pull origin main`. The nutrition work is on
`nutrition-feature`, and the PR for it targets `dev`. So the ordering is:

1. Merge `nutrition-feature` → `dev` (the PR this document ships with).
2. Merge `dev` → `main`.
3. Only then run `./deploy.sh` on the Pi.

If you want to deploy from `dev` without touching `main`, do **not** edit `deploy.sh` — run
the manual path instead (Option B in the skill):

```bash
ssh n1k0@n1k0blc-pi.local
cd ~/apps/Workout-Tracker
git fetch origin && git checkout dev && git pull origin dev
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Everything else in this document is identical either way.

---

## 1. Prerequisites

### On the Mac

```bash
cd ~/Projects/Workout-Tracker
git status                       # clean
pnpm install
cd apps/backend && pnpm exec prisma generate && cd ../..
```

`prisma generate` matters: phases B and C run `ts-node` against the generated client in
`apps/backend/generated/prisma`.

You also need ~1.5 GB free disk for the Open Food Facts export (phase C). The export is
downloaded to the **Mac**, never to the Pi.

### On the Pi

```bash
ssh n1k0@n1k0blc-pi.local
cd ~/apps/Workout-Tracker
df -h .                          # >5 GB free, deploy.sh warns below that
free -m                          # >500 MB available, deploy.sh warns below that
git log --oneline -1             # note this commit — it is your rollback target
git status --short               # see the skill's note on harmless mode-only dirt
curl -sI https://static.openfoodfacts.org/data/delta/index.txt | head -1   # outbound OK?
```

The last check matters for phase D: the delta sync runs *on the Pi* and needs outbound
HTTPS to `static.openfoodfacts.org`. The live barcode lookup (#149) additionally needs
`world.openfoodfacts.org` from the backend container.

### Determine the real deploy range

Do not assume the Pi is one PR behind — check (skill, lesson from PR #107):

```bash
PI=<commit-from-the-Pi>
git log --oneline $PI..origin/main
git diff --name-only $PI..origin/main -- apps/backend/prisma/migrations | grep migration.sql
```

Against `origin/dev` the nutrition branch adds **7** migrations (listed in A.2). If the Pi
is behind `dev` as well, the container will apply those older migrations in the same start —
`migrate deploy` applies everything pending, in order, and that is fine. Just count them so
the log verification in A.3 expects the right number.

### No new env vars, no infra changes

Verified: `nutrition-feature` changes **nothing** in `.env.production.example`,
`docker-compose.prod.yml`, either `Dockerfile`, or `.env.example` relative to `dev`. The only
infra additions are the two new root scripts `sync-off-foods.sh` and
`install-off-sync-cron.sh` (phase D). `.env.production` on the Pi needs no edit.

---

## 2. Backup — mandatory

`deploy.sh` does **not** back up. This deployment writes ~181,000 rows across three phases.

```bash
# on the Pi
cd ~/apps/Workout-Tracker
./backup.sh
```

Must end with `✅ Backup complete!` and a plausible file size. Note the filename in
`~/backups/workout-tracker/db_backup_<date>.sql.gz` — that is your restore point for the
whole deployment, not just one phase.

Take a **second** backup after phase B and before phase C (see C.2): phase C is by far the
largest write, and being able to roll back to "schema + seed, no import" is more useful than
rolling back to before everything.

---

## Phase A — Code and schema migrations

### A.1 Pre-deployment checks on the Mac

Production builds catch TypeScript errors that `pnpm run dev` does not — the skill is
emphatic about this.

```bash
cd ~/Projects/Workout-Tracker
pnpm run backend:build
pnpm run frontend:build
pnpm --filter backend run test
pnpm --filter frontend run test
```

The frontend build's `prebuild` step copies `zxing_reader.wasm` into `apps/frontend/public/`.
That binary is what makes the barcode scanner work on iOS Safari, which has no native
`BarcodeDetector`. It is copied at build time rather than committed, and the frontend
Dockerfile copies `public/` out of the builder stage — so a normal production build carries
it. If the scanner later shows "kein Decoder" on iPhone, check that this file is present in
the running container.

### A.2 Run the deployment

```bash
# on the Pi
cd ~/apps/Workout-Tracker
./deploy.sh
```

Expect **~10 minutes** for backend + frontend with a warm layer cache. The Dockerfiles are
unchanged in this branch, so the cache should be warm; a cold cache is considerably longer.
Announce it — a long build is not a hang.

The backend container applies the schema itself on start:

```yaml
command: sh -c "npx prisma migrate deploy && node dist/src/main.js"
```

The seven migrations this brings, in order:

| Migration | Ticket | What it does |
|---|---|---|
| `20260908071941_add_nutrition_meal_slots_and_diary_entries` | #141 | `MealSlot` + `DiaryEntry`; `CHECK` on `localDate`'s `YYYY-MM-DD` shape; unique `(userId, order)`; **backfills the four default Abschnitte for every existing user** |
| `20260908091840_add_food_library` | #143 | `FoodSource` enum, `Food`, `FoodPortion`; globally unique `barcode` |
| `20260908140000_add_food_seed_key` | #145 | `Food.seedKey` unique — the idempotency key for phase B |
| `20260909100000_add_meals` | #147 | `Meal` + `MealItem`; attaches the `DiaryEntry.mealId` FK |
| `20260909110000_add_diary_entry_meal_name` | #147 | `DiaryEntry.mealName` snapshot column |
| `20260909120000_add_food_and_meal_favorites` | #148 | `FoodFavorite`, `MealFavorite` |
| `20260909130000_add_user_daily_targets` | #152 | `User.targetKcal/targetCarbs/targetProtein/targetFat` |

The first one carries a data backfill in SQL, which is why it still belongs to phase A and
not to phase B — the container handles it. All seven are additive: no column is dropped, no
existing row is rewritten except `User` gaining four NULL columns.

> **Never run `prisma migrate dev` against the Pi.** It re-proposes a stray
> `DROP DEFAULT` on `Workout.updatedAt` that has nothing to do with this feature.
> `migrate deploy` only, and the container does it for you.

### A.3 Verify the migrations — do not trust the health check

`deploy.sh`'s health check proves the process is up, not that the schema moved.

```bash
# on the Pi
docker compose -f docker-compose.prod.yml logs backend | grep -iA10 "migrat"
```

Expect `7 migrations found` / `successfully applied`. If a migration fails, the backend does
not start, the frontend's `depends_on: healthy` keeps it down too, and the outage is visible.

Then check the schema and the backfill:

```bash
docker exec workout-tracker-db-prod psql -U workoutuser -d workout_tracker -c '\dt'
# expect the new tables: MealSlot, DiaryEntry, Food, FoodPortion, Meal, MealItem,
# FoodFavorite, MealFavorite

# Every user got exactly four Abschnitte, orders 1..4, none missing:
docker exec workout-tracker-db-prod psql -U workoutuser -d workout_tracker -c '
SELECT u.id, u.email, count(s.id) AS slots
FROM "User" u LEFT JOIN "MealSlot" s ON s."userId" = u.id
GROUP BY u.id, u.email ORDER BY slots;'
# every row must read 4 — a 0 means the backfill missed that user

docker exec workout-tracker-db-prod psql -U workoutuser -d workout_tracker -c '
SELECT "targetKcal", "targetCarbs", "targetProtein", "targetFat" FROM "User" LIMIT 3;'
# all NULL is correct — targets are manual only (#152)
```

A user with 0 slots (created mid-deploy, say) is repairable without hand-written SQL:
`MealSlotsService.createDefaultsForUser` exists as the recovery seam.

### A.4 Smoke test before touching data

Open https://workout.nikobjelic.com, log in, and check that **Ernährung** appears in the
navigation and the Tagesansicht renders the four empty Abschnitte. The library is empty at
this point — that is expected; phases B and C fill it.

Stop here if anything is wrong. Phases B and C are much easier to reason about against a
known-good app.

---

## Phase B — Seed the 289 curated Lebensmittel

From #145. Runs from the **Mac** through the SSH tunnel.

### B.1 Open the tunnel

Postgres is deliberately not exposed on the Pi (`docker-compose.prod.yml` has no `ports:`
for it), so the tunnel targets the container's IP on the Docker network:

```bash
# on the Mac
cd ~/Projects/Workout-Tracker

DB_IP=$(ssh n1k0@n1k0blc-pi.local "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' workout-tracker-db-prod")
echo "DB IP: $DB_IP"

ssh -f -N -L 5433:${DB_IP}:5432 n1k0@n1k0blc-pi.local

# credentials live on the Pi:
ssh n1k0@n1k0blc-pi.local "cd ~/apps/Workout-Tracker && grep '^DB_' .env.production"
```

Sanity-check the tunnel before you write anything:

```bash
psql "postgresql://workoutuser:<PASS>@localhost:5433/workout_tracker" -c 'SELECT count(*) FROM "Food";'
# 0 at this point
```

### B.2 Run the seed

```bash
cd ~/Projects/Workout-Tracker/apps/backend

DATABASE_URL="postgresql://workoutuser:<PASS>@localhost:5433/workout_tracker" \
  pnpm run prisma:seed
```

> **Use `pnpm run prisma:seed`, never `prisma db seed`.** `prisma.config.ts` loads
> `.env.local` with `override: true`, so `prisma db seed` would silently swap your tunnel
> URL for the local dev database and seed the wrong machine. `prisma:seed` invokes
> `ts-node prisma/seed.ts` directly, which loads `.env` **without** override — so the
> `DATABASE_URL` you set on the command line wins. The same rule applies to phase C.

**What this script actually does** — it is not foods-only. One run seeds:

- **115 Übungen** from `Exercises_premium.csv`, upserted on `csvId`
- **289 Lebensmittel** from `FoodsSeed.csv`, upserted on `seedKey` as `source = SEED`

Both are idempotent upserts and the seed never deletes, so re-running is safe. It does mean
the exercise library gets refreshed as a side effect — expected, but worth knowing before
you see exercise log lines scroll past.

### B.3 Verify

```bash
psql "postgresql://workoutuser:<PASS>@localhost:5433/workout_tracker" <<'SQL'
SELECT source, count(*) FROM "Food" GROUP BY source;
-- expect SEED = 289

SELECT count(*) FROM "FoodPortion";
-- >0; seeded staples carry named portions ("1 Stück", "1 Scheibe", …)

SELECT count(*) FROM "Food" WHERE source = 'SEED' AND "seedKey" IS NULL;
-- must be 0
SQL
```

289 is exactly the row count of `FoodsSeed.csv`, and stays correct as long as no row is
removed from the CSV (the seed never deletes).

In the app: **Vorlagen → Lebensmittel** now lists 289 read-only "System" entries.

### B.4 Second backup

Close the tunnel (or leave it — phase C reuses it), then on the Pi:

```bash
./backup.sh
```

This is the "schema + seed, no import" restore point.

---

## Phase C — Open Food Facts bulk import (~180,000 rows)

From #146. The one criterion that ticket closed with unchecked, deliberately, to be done
here. Runs from the **Mac** through the same tunnel.

### C.1 Get the export

```bash
# on the Mac, somewhere with 1.5 GB free
cd ~/Projects/Workout-Tracker
curl -L -o off.csv.gz https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
ls -lh off.csv.gz     # ~1.2 GB
```

It is **tab-separated despite the `.csv` name**, and regenerated nightly, so your funnel
numbers will differ slightly from the ones recorded in #146. Do not commit it — it is derived
data from a nightly-changing source.

The CSV is the right source, not the JSONL: Open Food Facts migrated the JSONL export to a
`nutrition.input_sets` schema and empties the legacy `nutriments` block there, while the CSV
keeps stable flat `*_100g` columns. The first two comments on #146 recommend JSONL and were
corrected later in the same issue.

### C.2 Dry run first

No tunnel, no `DATABASE_URL` needed — it writes nothing:

```bash
cd ~/Projects/Workout-Tracker/apps/backend
pnpm run import:off -- --file ../../off.csv.gz --dry-run
```

Takes ~75 seconds and prints the funnel. For reference, the run recorded in #146:

```
rows                                                     4,535,553
German                                                     408,727
  dropped, no usable macros                                182,538
  rejected, barcode not 13 digits with valid check digit    21,108
  rejected, macros disagree with stated kcal                 17,353
  rejected, no name                                           6,629
  rejected, impossible per-100 value                            243
  rejected, zero kcal but macros present                        173
importable                                                 180,683
```

If your "importable" figure is wildly off (say, under 100k or over 300k), stop and
investigate before writing — it means the export's shape changed again.

### C.3 Import a slice, then the rest

Confirm your backup from B.4 exists first. Then, with the tunnel from B.1 open:

```bash
cd ~/Projects/Workout-Tracker/apps/backend

# 1. a small slice, to watch it land over the tunnel
DATABASE_URL="postgresql://workoutuser:<PASS>@localhost:5433/workout_tracker" \
  pnpm run import:off -- --file ../../off.csv.gz --limit 2000

# verify, then the full run
DATABASE_URL="postgresql://workoutuser:<PASS>@localhost:5433/workout_tracker" \
  pnpm run import:off -- --file ../../off.csv.gz
```

Flags: `--limit N` imports a slice, `--batch N` changes the batch size from the default 500,
`--dry-run` writes nothing.

The importer batches 500 at a time with one lookup query per batch, so it never holds the
export in memory and never locks the table for long. It looks each batch up before writing
and **skips any barcode already owned by a `USER` or `SEED` row** — barcodes are globally
unique across sources, so a plain upsert would overwrite someone's own food. Only
`OPEN_FOOD_FACTS` rows are ever written.

### C.4 How long, and what if it dies

Local full import against the dev database: **180,683 rows in 391 seconds**. Over the SSH
tunnel to the Pi, expect **considerably longer** — it is ~360 round-tripped batches against a
Raspberry Pi rather than a loopback socket. Budget 30–90 minutes and do not run it from a
laptop that will sleep. `caffeinate -i` on the Mac, or run it inside `tmux`/`screen`.

If it dies mid-run: nothing is corrupted. The import is idempotent per barcode, so just run
it again — already-written rows update in place.

### C.5 Verify

```bash
psql "postgresql://workoutuser:<PASS>@localhost:5433/workout_tracker" <<'SQL'
SELECT source, count(*) FROM "Food" GROUP BY source;
-- SEED 289, OPEN_FOOD_FACTS ~180k, USER = whatever existed before (unchanged)

SELECT count(*) FROM "Food" WHERE source = 'OPEN_FOOD_FACTS' AND "lastSyncedAt" IS NULL;
-- must be 0

SELECT count(*) FROM "Food" WHERE "barcode" IS NOT NULL
  GROUP BY "barcode" HAVING count(*) > 1;
-- no rows: barcode is the clean upsert key

SELECT pg_size_pretty(pg_database_size('workout_tracker'));
SQL
```

Check the Pi's disk afterwards — `df -h` — since `deploy.sh` warns below 5 GB free and the
import is the largest single growth this app has ever taken.

### C.6 Close the tunnel

```bash
lsof -ti:5433 | xargs kill -9
# or: pkill -f "ssh.*n1k0blc-pi.local.*5433"
```

### C.7 Report back

#146's acceptance criterion "Import executed on the Pi; row count and duration reported in
this issue" is still open. Post the funnel output, the final row count and the wall-clock
duration to
[#146](https://github.com/n1k0blc/Workout-Tracker/issues/146) and tick the box.

---

## Phase D — Daily Open-Food-Facts delta sync

From #150. Runs **on the Pi**.

### D.1 Install the cron

```bash
ssh n1k0@n1k0blc-pi.local
cd ~/apps/Workout-Tracker
./install-off-sync-cron.sh
crontab -l | grep sync-off-foods
```

Writes, idempotently:

```
0 9 * * * /home/n1k0/apps/Workout-Tracker/sync-off-foods.sh >> /home/n1k0/logs/off-sync.log 2>&1
```

**Daily at 09:00, not Sunday at 04:00** — the acceptance criteria on #150 say the latter and
were superseded after the feed was measured. Two reasons:

- Open Food Facts publishes one delta per day at ~06:10 UTC. 04:00 Berlin is 02:00 UTC —
  four hours *before* the file it is meant to fetch exists. 09:00 Berlin is 07:00 UTC in
  summer and 08:00 in winter, past publication in both DST states, and still well after the
  03:00 backup.
- The delta windows are contiguous, so seven daily runs download exactly the same ~154 MB
  one weekly run would. Daily costs no extra bandwidth and doubles the slack against the
  ~13-day retention: a failed daily run is covered by tomorrow's, a failed weekly run has to
  be *noticed* within six days.

If a crontab entry for the script already exists, the installer leaves it alone and says so.

### D.2 Dry run

```bash
./sync-off-foods.sh --dry-run
```

Counts only; writes nothing and leaves the marker untouched. This is also the check that
`docker exec workout-tracker-backend-prod node dist/src/foods/off-sync.js` resolves — that
file only exists in the image because `off-sync.ts` lives under `src/` rather than next to
the other data scripts in `prisma/`.

### D.3 First real run

```bash
./sync-off-foods.sh
```

**No marker file is needed for the first run.** With `~/logs/off-sync.state` absent, the sync
falls back to the library's own last bulk refresh — specifically, the newest `lastSyncedAt`
that at least 100 rows share. That threshold is deliberate: the live barcode lookup (#149)
stamps `lastSyncedAt = now` on every product it caches, so a plain maximum would be a single
scanned row and the sync would skip every delta back to the import and still report success.
A bulk write stamps thousands of rows with one instant; a scan stamps one.

So run phase D **after** phase C, or the fallback has no bulk timestamp to find.

Expect, per delta file, roughly: ~7,000 products in → ~400 importable German ones after the
shared quality gate → a mix of created and updated. ~5 seconds per file. The run ends with
`✅ Sync complete. Marker advanced to <epoch>.`

### D.4 Verify

```bash
cat ~/logs/off-sync.state          # a unix timestamp, recent
tail -40 ~/logs/off-sync.log
```

And that nothing outside `OPEN_FOOD_FACTS` moved:

```bash
docker exec workout-tracker-db-prod psql -U workoutuser -d workout_tracker -c '
SELECT source, count(*), max("updatedAt") FROM "Food" GROUP BY source;'
# SEED and USER counts unchanged, their updatedAt not bumped by the sync
```

Diary entries cannot move regardless: they are snapshots (ADR-0002), so a refreshed food
never rewrites history.

If the run fails, the marker is left untouched on purpose — the next run retries the same
window. If the gap ever exceeds the ~13-day retention, the script logs a warning pointing
back at `import:off`; the fix is to re-run phase C.

### D.5 Report back

#150's last open criterion is "Installed on the Pi; first run result reported in this
issue". Post the crontab line and the first run's counts to
[#150](https://github.com/n1k0blc/Workout-Tracker/issues/150) and tick the box.

---

## 3. Post-deployment functional check

Do this on a phone, over HTTPS — the barcode scanner needs a secure context, which the
Cloudflare tunnel provides.

| # | Check | Ticket |
|---|---|---|
| 1 | Login, then a normal workout still logs correctly (the seed touched exercises) | regression |
| 2 | **Ernährung** in the nav; Tagesansicht shows four Abschnitte | #141 |
| 3 | Schnelleintrag with name + kcal/macros lands in the right Abschnitt | #141 |
| 4 | Abschnitte verwalten: rename, reorder, archive, unarchive | #142 |
| 5 | Vorlagen → Lebensmittel: count line reads roughly "180.972 Lebensmittel · N eigene"; ODbL attribution visible | #143, #146 |
| 6 | Search "Milch": your own foods first, then SEED staples, then imports | #155 |
| 7 | Log a food from the picker with a portion and a free-gram quantity | #144 |
| 8 | Create a Mahlzeit, log it with a Faktor, expand it into its ingredients | #147 |
| 9 | Star a food in the picker; it appears under Favoriten; Zuletzt fills up | #148 |
| 10 | **Scan a real EAN with the phone camera** — library hit | #149 |
| 11 | Scan a product not in the library → live OFF lookup caches it | #149 |
| 12 | Manual EAN field works on desktop | #149 |
| 13 | "Von anderem Tag kopieren" for an Abschnitt and a whole day | #151 |
| 14 | Tagesziele in the profile; dashboard shows consumed vs target | #152 |
| 15 | Analytics: Ernährung chart with kcal/KH/Protein/Fett toggle and the Ziel line | #153 |

Check 11 is the one that needs outbound network from the backend container to
`world.openfoodfacts.org`. Check 10 on **iOS specifically** exercises the zxing WASM fallback
rather than the native `BarcodeDetector`.

Also watch the backend logs for a few minutes:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Known harmless noise, per the skill: the `LegacyRouteConverter` warning about `/api/*` and
the npm update hint. Neither is an error.

---

## 4. Rollback

| Failure point | What to do |
|---|---|
| Phase A build fails | Nothing changed. Fix on the Mac, redeploy. |
| Phase A migration fails | The backend does not start, so the frontend stays down too. Read the migration error in the backend logs. Restore: `./restore.sh ~/backups/workout-tracker/db_backup_<date>.sql.gz`, then `git checkout <pi-commit>` and rebuild. |
| Phase B (seed) misbehaves | Idempotent upsert — usually just re-run. If a bad CSV landed rows you do not want, restore the pre-deployment backup. |
| Phase C dies mid-import | Re-run; it updates in place. Nothing is half-written per row. |
| Phase C imported garbage | Restore the B.4 backup ("schema + seed, no import"), fix the filter, import again. |
| Phase D misbehaves | `crontab -e` and remove the line; delete `~/logs/off-sync.state`. The library keeps whatever phase C wrote. No app-visible impact. |

Rollback target is the commit that was on the Pi **before** this deployment — the one you
noted in §1. A database restore and a code rollback belong together: the nutrition tables
are additive, so old code against the new schema mostly works, but do not rely on it.

---

## 5. Known risks and gotchas

**Search latency on 180k rows.** `FoodsService.findAll` searches with
`contains … mode: 'insensitive'`, which is `ILIKE '%term%'` — unindexable, and now running
against ~181,000 rows on a Raspberry Pi. #155 made the *ranking* correct by splitting the
query into three source-grouped queries, but it did not add a trigram index. Watch the
picker's responsiveness after phase C. If it is slow, a `pg_trgm` GIN index on
`Food.name`/`Food.brand` is the obvious follow-up, and it is a schema change, so it needs its
own migration and its own ticket.

**The seed also re-seeds exercises.** One run of `prisma:seed` upserts both
`Exercises_premium.csv` (115 rows, on `csvId`) and `FoodsSeed.csv` (289 rows, on `seedKey`).
There is no foods-only entry point. Expected and safe, but check 1 in §3 exists because of it.

**`prisma db seed` silently targets the wrong database.** Covered in B.2 — repeated here
because it is the single easiest way to get this deployment wrong and it fails *quietly*,
seeding your laptop instead of the Pi.

**The export changes nightly.** Your phase C funnel numbers will not match #146's exactly.
That is normal. A large deviation is not.

**`countries_tags: en:germany` is not a quality filter.** It means "a user said this is sold
in Germany". The quality gate (valid 13-digit EAN, complete macros, ±15% Atwater consistency)
is what keeps animal feed and mislabelled foreign products out. Do not be tempted to filter
on the German GS1 prefix 40–44 instead — measured, it drops legitimate German retailer
products that carry zero-padded UPC-A codes.

**Dirty working tree on the Pi.** Usually harmless file modes from an earlier `chmod +x`.
Check with `git diff --stat` before doing anything. Do **not** blindly `git checkout --` —
that strips `deploy.sh`'s execute bit and blocks the deployment.

---

## 6. Completion checklist

- [ ] Pre-deployment backup taken and verified
- [ ] `nutrition-feature` → `dev` → `main` merged (or manual deploy from `dev`)
- [ ] Phase A: `deploy.sh` green, 7 migrations applied, every user has 4 Abschnitte
- [ ] Phase B: 289 `SEED` foods present
- [ ] Second backup taken
- [ ] Phase C: ~180k `OPEN_FOOD_FACTS` foods present, no duplicate barcodes, `USER`/`SEED` untouched
- [ ] Phase D: cron installed at `0 9 * * *`, dry run clean, first real run advanced the marker
- [ ] All 15 functional checks in §3 pass
- [ ] Row count + duration reported on #146, criterion ticked
- [ ] Cron line + first-run counts reported on #150, criterion ticked
- [ ] Epic #139 closed
