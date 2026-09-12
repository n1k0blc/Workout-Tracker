/**
 * The daily Open Food Facts deltas, behind the sync job (#150).
 *
 * Open Food Facts publishes one gzipped JSONL file per day at
 * https://static.openfoodfacts.org/data/delta/ and lists them, newest first, in `index.txt`.
 * A name carries the window it covers as a pair of unix seconds:
 *
 *   openfoodfacts_products_1788847691_1788934590.json.gz
 *
 * which is what makes both jobs here exact arithmetic rather than date guessing: picking the
 * files a marker has not seen, and noticing that the marker is older than the ~13 days of
 * history kept, so a window is gone for good and only a full re-import can fill it.
 *
 * Everything after a line is parsed is the code the bulk import (#146) already uses: the
 * `fromExportProduct` adapter -- the deltas carry the same `nutrition.input_sets` shape as the
 * full JSONL export -- then the market filter, the quality gate and the mapping.
 */
import * as readline from 'readline';
import * as zlib from 'zlib';
import { Readable } from 'stream';
import {
  fromExportProduct,
  isSoldInGermany,
  mapOffProduct,
  rejectOffProduct,
  MappedFood,
} from './off-mapping';

export const DELTA_BASE_URL = 'https://static.openfoodfacts.org/data/delta';

export type DeltaFile = {
  name: string;
  /** Unix seconds. The window this file covers, `from` exclusive and `to` inclusive. */
  from: number;
  to: number;
};

export type DeltaPlan = {
  /** The files to download, oldest first. */
  files: DeltaFile[];
  /**
   * The marker to record once every file above has been applied. Never earlier than the one
   * passed in: a marker bootstrapped from `lastSyncedAt` can sit ahead of every published
   * window, and moving it back would re-apply files that are already in.
   */
  marker: number | null;
  /** A gap in the history, or null when the marker is covered by what is still published. */
  warning: string | null;
};

const FILE_NAME = /^openfoodfacts_products_(\d+)_(\d+)\.json\.gz$/;

/**
 * Which delta files still have to be applied, given the marker of the last successful run.
 * A null marker means the sync has never run and has no import date to fall back on either,
 * so it takes everything published and says what it could not cover.
 */
export function planDeltaSync(indexText: string, since: number | null): DeltaPlan {
  const files: DeltaFile[] = [];
  for (const line of indexText.split('\n')) {
    const match = FILE_NAME.exec(line.trim());
    if (match) files.push({ name: match[0], from: Number(match[1]), to: Number(match[2]) });
  }
  files.sort((a, b) => a.from - b.from);

  if (files.length === 0) {
    return {
      files: [],
      marker: since,
      warning: 'The delta index lists no delta files. Nothing was applied.',
    };
  }

  const pending = since === null ? files : files.filter((file) => file.to > since);
  const oldest = files[0];
  const warning =
    since === null
      ? `No last-run marker, so only the ${files.length} delta files still published were ` +
        `applied. Anything older is gone; re-run the full import (pnpm run import:off) if the ` +
        `library was never bulk-imported.`
      : since < oldest.from
        ? `Last run ended at ${iso(since)}, but the oldest delta still published starts at ` +
          `${iso(oldest.from)}. That window is past Open Food Facts' retention and cannot be ` +
          `synced -- re-run the full import (pnpm run import:off) to close the gap.`
        : null;

  const newest = files[files.length - 1].to;
  return { files: pending, marker: since === null ? newest : Math.max(newest, since), warning };
}

function iso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}

/** What a delta file's products funnelled down to, for the run's log line. */
export type DeltaFunnel = {
  products: number;
  /** No usable nutrient set: the four macros, as sold, per 100. */
  unmapped: number;
  notGerman: number;
  /** Dropped by the quality gate: bad EAN, impossible values, macros against kcal. */
  rejected: number;
  importable: number;
};

export function emptyFunnel(): DeltaFunnel {
  return { products: 0, unmapped: 0, notGerman: 0, rejected: 0, importable: 0 };
}

/**
 * Streams one gzipped delta file and yields the products worth writing, counting the funnel
 * on the way. A line that will not parse is skipped rather than failing the run: the file is
 * 22 MB of third-party JSONL, and one bad line is not worth losing the other 6,000 products.
 */
export async function* readDeltaProducts(
  gzipped: Readable,
  funnel: DeltaFunnel,
): AsyncGenerator<MappedFood> {
  const lines = readline.createInterface({
    input: gzipped.pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    funnel.products++;

    const product = fromExportProduct(raw);
    if (!product) {
      funnel.unmapped++;
      continue;
    }
    if (!isSoldInGermany(product)) {
      funnel.notGerman++;
      continue;
    }
    if (rejectOffProduct(product)) {
      funnel.rejected++;
      continue;
    }
    funnel.importable++;
    yield mapOffProduct(product);
  }
}
