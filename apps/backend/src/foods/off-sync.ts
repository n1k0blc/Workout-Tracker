/**
 * The Open Food Facts delta sync (#150).
 *
 * Open Food Facts publishes one delta a day, around 06:10 UTC, and keeps about 13 of them, so
 * this runs daily at 09:00 -- past publication in both DST states. Daily rather than weekly
 * because the windows are contiguous: seven daily runs fetch exactly the files one weekly run
 * would, at the same total bandwidth, but leave twelve days of slack against retention instead
 * of six.
 *
 * It downloads the delta files published since the last successful run and applies them
 * with the same adapter, filter and mapping the bulk import (#146) uses, so an existing
 * OPEN_FOOD_FACTS row is refreshed and a new qualifying German product is added. Rows of any
 * other source are never touched, and diary entries are snapshots, so history cannot move.
 *
 * It lives under `src/` rather than next to the other data scripts in `prisma/` because it is
 * the one script that has to run *inside* the production container: the image installs
 * production dependencies only, so there is no ts-node, and only `src/` is compiled into
 * `dist/`. The host cron therefore runs
 *
 *   docker exec workout-tracker-backend-prod node dist/src/foods/off-sync.js --since <epoch>
 *
 * see `sync-off-foods.sh`. Locally: `pnpm run sync:off -- --dry-run` with DATABASE_URL set.
 *
 * The last-run marker is a unix second -- the end of the newest delta window applied -- and
 * lives in a file the host wrapper owns, so this script stays stateless: it takes the marker
 * as `--since` and prints the next one as its last line. Without one it falls back to the
 * library itself, see {@link lastBulkSyncAt}.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Readable } from 'stream';
import { PrismaClient } from '../../generated/prisma/client';
import {
  DELTA_BASE_URL,
  DeltaPlan,
  emptyFunnel,
  planDeltaSync,
  readDeltaProducts,
} from './off-delta';
import { importOffProducts } from './off-import';
import { OFF_USER_AGENT } from './off-lookup';

/** The last line of a successful run, for the wrapper script to record. */
const MARKER_PREFIX = 'off-sync-marker';

/** The index is a few hundred bytes; a delta file is ~22 MB over the Pi's connection. */
const INDEX_TIMEOUT_MS = 30_000;
const FILE_TIMEOUT_MS = 10 * 60_000;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const DRY_RUN = process.argv.includes('--dry-run');
const SINCE = arg('since');

async function get(url: string, timeoutMs: number): Promise<Response> {
  const response = await fetch(url, {
    headers: { 'User-Agent': OFF_USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok || !response.body) {
    throw new Error(`GET ${url} answered ${response.status}`);
  }
  return response;
}

/**
 * A bulk write stamps every row it touches with one instant -- `importOffProducts` takes a
 * single `now` for the whole run -- so a `lastSyncedAt` thousands of rows share is an import
 * or a sync, and one a single row holds is a barcode scan the live lookup cached (#149).
 */
const BULK_ROWS = 100;

/**
 * Where to resume when the wrapper has no marker file yet: the last time the library was
 * refreshed in bulk. Deliberately not the plain newest `lastSyncedAt` -- that is whenever
 * somebody last scanned something, which runs ahead of the deltas and would make the sync
 * skip the window between the import and that scan without ever warning about it.
 *
 * Erring old is the safe direction: re-applying a delta is idempotent, and a marker past
 * retention is reported. Null when no bulk write has ever happened, which the caller treats
 * as "no marker" -- every delta still published, and a warning.
 */
async function lastBulkSyncAt(prisma: PrismaClient): Promise<number | null> {
  const [newest] = await prisma.food.groupBy({
    by: ['lastSyncedAt'],
    where: { source: 'OPEN_FOOD_FACTS', lastSyncedAt: { not: null } },
    having: { lastSyncedAt: { _count: { gte: BULK_ROWS } } },
    orderBy: { lastSyncedAt: 'desc' },
    take: 1,
  });
  return newest?.lastSyncedAt ? Math.floor(newest.lastSyncedAt.getTime() / 1000) : null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }
  if (SINCE !== undefined && !/^\d+$/.test(SINCE)) {
    console.error(`❌ --since must be a unix timestamp in seconds. Got: ${SINCE}`);
    process.exit(1);
  }
  const started = Date.now();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const stats = { created: 0, updated: 0, skipped: 0 };
  const funnel = emptyFunnel();
  let plan: DeltaPlan;

  try {
    const since = SINCE ? Number(SINCE) : await lastBulkSyncAt(prisma);
    console.log(
      `🌍 Open Food Facts delta sync${DRY_RUN ? ' (dry run)' : ''}, resuming from ` +
        `${since === null ? 'nothing' : new Date(since * 1000).toISOString()}` +
        `${SINCE ? '' : " (the library's last bulk refresh)"}`,
    );

    plan = planDeltaSync(
      await (await get(`${DELTA_BASE_URL}/index.txt`, INDEX_TIMEOUT_MS)).text(),
      since,
    );
    if (plan.warning) console.warn(`⚠️  ${plan.warning}`);
    console.log(`📦 ${plan.files.length} delta file(s) to apply`);

    for (const file of plan.files) {
      const response = await get(`${DELTA_BASE_URL}/${file.name}`, FILE_TIMEOUT_MS);
      const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
      const products = readDeltaProducts(body, funnel);
      if (DRY_RUN) {
        // Drain the stream so the funnel is reported, but write nothing.
        for await (const _ of products) void _;
      } else {
        const fileStats = await importOffProducts(prisma, products);
        stats.created += fileStats.created;
        stats.updated += fileStats.updated;
        stats.skipped += fileStats.skipped;
      }
      console.log(`   ${file.name}: ${funnel.importable} importable of ${funnel.products} so far`);
    }
  } finally {
    await prisma.$disconnect();
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`\n📋 products ${funnel.products.toLocaleString()}`);
  console.log(`   dropped, no usable macros: ${funnel.unmapped.toLocaleString()}`);
  console.log(`   dropped, not sold in Germany: ${funnel.notGerman.toLocaleString()}`);
  console.log(`   rejected by the quality gate: ${funnel.rejected.toLocaleString()}`);
  console.log(`   importable: ${funnel.importable.toLocaleString()}`);
  if (DRY_RUN) {
    console.log(`\n✅ Dry run finished in ${seconds}s. Nothing was written.`);
    return;
  }
  console.log(
    `\n✅ ${stats.created.toLocaleString()} created, ${stats.updated.toLocaleString()} updated, ` +
      `${stats.skipped.toLocaleString()} skipped (barcode owned by a seed or user food), in ${seconds}s.`,
  );
  // Last line on purpose: the wrapper reads it to advance the marker file.
  if (plan.marker !== null) console.log(`${MARKER_PREFIX} ${plan.marker}`);
}

main().catch((error) => {
  console.error('❌ Delta sync failed:', error);
  process.exit(1);
});
