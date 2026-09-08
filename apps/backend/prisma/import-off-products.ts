/**
 * Open Food Facts import (#146).
 *
 * Streams the nightly CSV export, keeps German products that pass the quality filter, and
 * upserts them by barcode as OPEN_FOOD_FACTS foods. Re-running updates rows in place.
 *
 *   pnpm run import:off -- --file ~/Downloads/en.openfoodfacts.org.products.csv.gz --dry-run
 *   DATABASE_URL="postgresql://…@localhost:5433/workout_tracker" pnpm run import:off -- --file …
 *
 * Get the export from https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
 * (~1.2 GB, regenerated nightly). Tab-separated despite the name. Against the Pi this is a
 * data script: open the SSH tunnel and set DATABASE_URL, see the deployment skill.
 */
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as zlib from 'zlib';
import { createPrismaClient } from './create-prisma-client';
import { fromCsvRow, mapOffProduct, rejectOffProduct, MappedFood } from '../src/foods/off-mapping';
import { importOffProducts } from '../src/foods/off-import';

config({ path: path.join(__dirname, '../.env') });
config({ path: path.join(__dirname, '../.env.local'), override: false });

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const FILE = arg('file');
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number(arg('limit') ?? '0');
const BATCH_SIZE = Number(arg('batch') ?? '500');

const rejected: Record<string, number> = {};
const counts = { rows: 0, german: 0, unmapped: 0, importable: 0 };

/** Streams the export and yields the products worth importing. */
async function* readExport(file: string): AsyncGenerator<MappedFood> {
  const lines = readline.createInterface({
    input: fs.createReadStream(file).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  let header: string[] = [];
  for await (const line of lines) {
    const cols = line.split('\t');
    if (header.length === 0) {
      header = cols;
      continue;
    }
    counts.rows++;
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      row[name] = cols[i] ?? '';
    });
    if (!(row.countries_tags ?? '').includes('en:germany')) continue;
    counts.german++;
    const product = fromCsvRow(row);
    if (!product) {
      counts.unmapped++;
      continue;
    }
    const reason = rejectOffProduct(product);
    if (reason) {
      const bucket = reason.replace(/"[^"]*"/, '"…"').replace(/[\d.]+/g, 'N');
      rejected[bucket] = (rejected[bucket] ?? 0) + 1;
      continue;
    }
    counts.importable++;
    yield mapOffProduct(product);
    if (LIMIT && counts.importable >= LIMIT) break;
  }
}

async function main() {
  if (!FILE || !fs.existsSync(FILE)) {
    console.error(`❌ Pass an existing export with --file. Got: ${FILE ?? '<nothing>'}`);
    process.exit(1);
  }
  console.log(`🌍 Importing Open Food Facts from ${FILE}${DRY_RUN ? ' (dry run)' : ''}`);
  const started = Date.now();
  const prisma = createPrismaClient();
  let stats = { created: 0, updated: 0, skipped: 0 };
  try {
    if (DRY_RUN) {
      // Drain the stream so the funnel is reported, but write nothing.
      for await (const _ of readExport(FILE)) void _;
    } else {
      stats = await importOffProducts(prisma, readExport(FILE), { batchSize: BATCH_SIZE });
    }
  } finally {
    await prisma.$disconnect();
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(
    `\n📋 rows ${counts.rows.toLocaleString()}, German ${counts.german.toLocaleString()}`,
  );
  console.log(`   dropped, no usable macros: ${counts.unmapped.toLocaleString()}`);
  for (const [reason, n] of Object.entries(rejected).sort((a, b) => b[1] - a[1])) {
    console.log(`   rejected, ${reason}: ${n.toLocaleString()}`);
  }
  console.log(`   importable: ${counts.importable.toLocaleString()}`);
  if (DRY_RUN) {
    console.log(`\n✅ Dry run finished in ${seconds}s. Nothing was written.`);
  } else {
    console.log(
      `\n✅ ${stats.created.toLocaleString()} created, ${stats.updated.toLocaleString()} updated, ` +
        `${stats.skipped.toLocaleString()} skipped (barcode owned by a seed or user food), in ${seconds}s.`,
    );
  }
}

main().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
