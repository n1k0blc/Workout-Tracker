import { Injectable, Logger } from '@nestjs/common';
import { fromApiProduct, mapOffProduct, rejectOffNutrition, MappedFood } from './off-mapping';

/**
 * The live Open Food Facts lookup behind a barcode scan (#149).
 *
 * The bulk import (#146) has the whole German export on disk; a scan has one code and no
 * warning, so this asks the public API for that single product. Everything after the response
 * is the shared `off-mapping` code, with two deliberate differences from the import:
 *
 *  - **No market filter.** `isSoldInGermany` scopes what we pull *into* the library; a code
 *    the user physically scanned is in their hand whatever the export says about it.
 *  - **No 13-digit rule.** The import's blanket EAN-8 rejection is a heuristic about the
 *    export's junk rows. Here the code has already passed `normalizeBarcode`, so the
 *    nutrition half of the gate is the only part that still applies.
 *
 * Every failure -- unknown product, bad data, network, Open Food Facts being down -- is a
 * miss. The caller's next step is the same in all of those cases: offer to create the food.
 */

const API_BASE = 'https://world.openfoodfacts.org/api/v2/product';

/** Only the fields the mapping reads, so the Pi is not parsing a 40 kB product document. */
const FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'categories_tags',
  'countries_tags',
  'nutriments',
].join(',');

/** Open Food Facts asks every client to identify itself; an anonymous UA gets rate-limited. */
export const OFF_USER_AGENT =
  'Workout-Tracker/1.0 (self-hosted; https://github.com/n1k0blc/Workout-Tracker)';

/** A scan is in the foreground with a user watching -- fail over to "Kein Treffer" quickly. */
const TIMEOUT_MS = 5000;

@Injectable()
export class OffLookupService {
  private readonly logger = new Logger(OffLookupService.name);

  /** The product behind this barcode, mapped and quality-checked, or null on any miss. */
  async lookup(barcode: string): Promise<MappedFood | null> {
    let payload: { status?: number; product?: Record<string, unknown> };
    try {
      const response = await fetch(
        `${API_BASE}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
        {
          headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        this.logger.warn(`Open Food Facts answered ${response.status} for ${barcode}`);
        return null;
      }
      payload = (await response.json()) as typeof payload;
    } catch (error) {
      this.logger.warn(
        `Open Food Facts lookup for ${barcode} failed: ${(error as Error).message}`,
      );
      return null;
    }

    if (payload.status !== 1 || !payload.product) return null;

    const product = fromApiProduct(payload.product);
    if (!product) return null;

    const reason = rejectOffNutrition(product);
    if (reason) {
      this.logger.log(`Open Food Facts product ${barcode} rejected: ${reason}`);
      return null;
    }

    // The API echoes whatever `code` the record carries; trust the code we validated instead.
    return { ...mapOffProduct(product), barcode };
  }
}
