import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FoodsService } from '../foods/foods.service';
import { MealsService } from '../meals/meals.service';
import { FavoritesService } from '../favorites/favorites.service';
import { PickerItemDto, PickerListDto } from './dto';

/** How many distinct items the Zuletzt tab shows. */
const RECENT_LIMIT = 20;

/** `'all'` -- foods and meals (the logging picker); `'food'` -- foods only (the Zutat search). */
export type PickerScope = 'all' | 'food';

/** The `?scope=` query param, narrowed: only the literal `food` restricts; anything else is `all`. */
export function toPickerScope(raw?: string): PickerScope {
  return raw === 'food' ? 'food' : 'all';
}

type EntrySlice = { foodId: string | null; mealId: string | null };
type UseSlice = EntrySlice & { createdAt: Date };
type Ref = { kind: 'food' | 'meal'; id: string };

/**
 * Backs the picker's Favoriten and Zuletzt tabs (#148).
 *
 *  - **Zuletzt** is derived, not stored: the last {@link RECENT_LIMIT} *distinct* foods and
 *    meals from the user's diary, most recently logged first. An entry expanded from a
 *    Mahlzeit counts toward the meal, never its ingredient foods.
 *  - **Favoriten** is the user's starred foods and meals, ordered by when each was last
 *    logged (most recent first); a favorite never logged sorts last, by when it was starred.
 *
 * Both tabs drop an item whose food or meal has since been soft-deleted -- it can no longer
 * be logged -- so a list may come back shorter than asked for.
 */
@Injectable()
export class PickerService {
  constructor(
    private prisma: PrismaService,
    private foods: FoodsService,
    private meals: MealsService,
    private favorites: FavoritesService,
  ) {}

  async getRecent(userId: string, scope: PickerScope): Promise<PickerListDto> {
    const where =
      scope === 'food'
        ? { userId, foodId: { not: null }, mealId: null }
        : { userId, OR: [{ foodId: { not: null } }, { mealId: { not: null } }] };

    // No `take`: the spec is "the last 20 distinct" unconditionally, and a diary with a few
    // items logged over and over would hide older distinct ones behind any scan cap. The walk
    // below stops at RECENT_LIMIT distinct, and the query is one userId-scoped index range
    // over two nullable id columns.
    const entries = (await this.prisma.diaryEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { foodId: true, mealId: true },
    })) as EntrySlice[];

    const seen = new Set<string>();
    const refs: Ref[] = [];
    for (const entry of entries) {
      const ref = this.refOf(entry, scope);
      if (!ref) continue;
      const key = `${ref.kind}:${ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
      if (refs.length >= RECENT_LIMIT) break;
    }

    return { items: await this.resolve(userId, refs) };
  }

  async getFavorites(userId: string, scope: PickerScope): Promise<PickerListDto> {
    const [foodFavs, mealFavs] = await Promise.all([
      this.favorites.listFoodFavorites(userId),
      scope === 'food'
        ? Promise.resolve([] as { mealId: string; createdAt: Date }[])
        : this.favorites.listMealFavorites(userId),
    ]);
    if (foodFavs.length === 0 && mealFavs.length === 0) {
      return { items: [] };
    }

    const foodIds = foodFavs.map((f) => f.foodId);
    const mealIds = mealFavs.map((m) => m.mealId);
    const lastUse = await this.lastUseByRef(userId, foodIds, mealIds);

    const ranked = [
      ...foodFavs.map((f) => ({
        kind: 'food' as const,
        id: f.foodId,
        lastUse: lastUse.get(`food:${f.foodId}`) ?? null,
        starredAt: f.createdAt.getTime(),
      })),
      ...mealFavs.map((m) => ({
        kind: 'meal' as const,
        id: m.mealId,
        lastUse: lastUse.get(`meal:${m.mealId}`) ?? null,
        starredAt: m.createdAt.getTime(),
      })),
    ];
    ranked.sort((a, b) => {
      if (a.lastUse !== null && b.lastUse !== null) return b.lastUse - a.lastUse;
      if (a.lastUse !== null) return -1;
      if (b.lastUse !== null) return 1;
      return b.starredAt - a.starredAt;
    });

    return { items: await this.resolve(userId, ranked) };
  }

  /** Which library row an entry belongs to: its meal if it came from one, else its food. */
  private refOf(entry: EntrySlice, scope: PickerScope): Ref | null {
    if (scope !== 'food' && entry.mealId != null) return { kind: 'meal', id: entry.mealId };
    if (entry.foodId != null) return { kind: 'food', id: entry.foodId };
    return null;
  }

  /** Newest `createdAt` per `food:<id>` / `meal:<id>`, for the favorites ordering. */
  private async lastUseByRef(
    userId: string,
    foodIds: string[],
    mealIds: string[],
  ): Promise<Map<string, number>> {
    const or: Record<string, unknown>[] = [];
    if (foodIds.length > 0) or.push({ foodId: { in: foodIds }, mealId: null });
    if (mealIds.length > 0) or.push({ mealId: { in: mealIds } });
    if (or.length === 0) return new Map();

    const uses = (await this.prisma.diaryEntry.findMany({
      where: { userId, OR: or },
      orderBy: { createdAt: 'desc' },
      select: { foodId: true, mealId: true, createdAt: true },
    })) as UseSlice[];

    const lastUse = new Map<string, number>();
    for (const use of uses) {
      const key = use.mealId != null ? `meal:${use.mealId}` : `food:${use.foodId}`;
      if (!lastUse.has(key)) lastUse.set(key, use.createdAt.getTime());
    }
    return lastUse;
  }

  /** Resolve refs to DTOs, preserving order and dropping any soft-deleted / missing row. */
  private async resolve(userId: string, refs: Ref[]): Promise<PickerItemDto[]> {
    const [foods, meals] = await Promise.all([
      this.foods.listByIds(
        userId,
        refs.filter((r) => r.kind === 'food').map((r) => r.id),
      ),
      this.meals.listByIds(
        userId,
        refs.filter((r) => r.kind === 'meal').map((r) => r.id),
      ),
    ]);
    const foodById = new Map(foods.map((f) => [f.id, f]));
    const mealById = new Map(meals.map((m) => [m.id, m]));

    const items: PickerItemDto[] = [];
    for (const ref of refs) {
      if (ref.kind === 'food') {
        const food = foodById.get(ref.id);
        if (food) items.push({ kind: 'food', food });
      } else {
        const meal = mealById.get(ref.id);
        if (meal) items.push({ kind: 'meal', meal });
      }
    }
    return items;
  }
}
