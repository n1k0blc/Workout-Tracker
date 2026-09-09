/**
 * The weekly Open Food Facts sync (#150).
 *
 * Downloads the daily delta files published since the last successful run and applies them
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
 * newest `lastSyncedAt` in the library, which is when the bulk import last wrote a row.
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
 * Where to resume when the wrapper has no marker file yet: the newest row the import or a
 * previous sync wrote. Null when the library holds no Open Food Facts food at all, which
 * means nothing has ever been imported.
 */
async function lastSyncedAt(prisma: PrismaClient): Promise<number | null> {
  const newest = await prisma.food.findFirst({
    where: { source: 'OPEN_FOOD_FACTS', lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: 'desc' },
    select: { lastSyncedAt: true },
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
    const since = SINCE ? Number(SINCE) : await lastSyncedAt(prisma);
    console.log(
      `🌍 Open Food Facts delta sync${DRY_RUN ? ' (dry run)' : ''}, resuming from ` +
        `${since === null ? 'nothing' : new Date(since * 1000).toISOString()}` +
        `${SINCE ? '' : ' (newest lastSyncedAt in the library)'}`,
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
