/**
 * Re-orders `rows` to match the sequence of `ids`, dropping any id that has no row. Used when
 * a batch `findMany({ where: { id: { in: ids } } })` loses the caller's intended order (the
 * nutrition picker's Favoriten / Zuletzt tabs decide it) and some ids may not resolve
 * (a soft-deleted row filtered out by the query).
 */
export function orderByIds<T>(ids: string[], rows: T[], idOf: (row: T) => string): T[] {
  const byId = new Map(rows.map((row) => [idOf(row), row]));
  return ids.map((id) => byId.get(id)).filter((row): row is T => row !== undefined);
}
