import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FavoritesService } from '../favorites/favorites.service';
import { orderByIds } from '../common/utils/order-by-ids';
import { normalizeBarcode } from './barcode';
import { OffLookupService } from './off-lookup';
import { MappedFood } from './off-mapping';
import {
  CreateFoodDto,
  UpdateFoodDto,
  FoodPortionInputDto,
  FoodDto,
  FoodListDto,
  SimilarFoodDto,
  BarcodeLookupDto,
} from './dto';

type PortionRow = {
  id: string;
  label: string;
  grams: number;
  order: number;
  isDefault: boolean;
};

type FoodRow = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  isLiquid: boolean;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  source: 'SEED' | 'OPEN_FOOD_FACTS' | 'USER';
  createdById: string | null;
  deletedAt: Date | null;
  portions?: PortionRow[];
};

const WITH_PORTIONS = { portions: { orderBy: { order: 'asc' as const } } };

function toDto(food: FoodRow, userId: string, favoriteIds?: Set<string>): FoodDto {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand ?? null,
    barcode: food.barcode ?? null,
    isLiquid: food.isLiquid,
    kcal: food.kcal,
    carbs: food.carbs,
    protein: food.protein,
    fat: food.fat,
    source: food.source,
    createdById: food.createdById ?? null,
    deleted: food.deletedAt !== null,
    editable: food.source === 'USER' && food.createdById === userId && food.deletedAt === null,
    isFavorite: favoriteIds?.has(food.id) ?? false,
    portions: (food.portions ?? []).map((p) => ({
      id: p.id,
      label: p.label,
      grams: p.grams,
      order: p.order,
      isDefault: p.isDefault,
    })),
  };
}

/** `{ label, grams, order, isDefault }` rows, `order` written from array position. */
function portionCreateData(portions: FoodPortionInputDto[] | undefined) {
  return (portions ?? []).map((p, index) => ({
    label: p.label.trim(),
    grams: p.grams,
    order: index + 1,
    isDefault: p.isDefault ?? false,
  }));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class FoodsService {
  constructor(
    private prisma: PrismaService,
    private favorites: FavoritesService,
    private offLookup: OffLookupService,
  ) {}

  /** Every non-deleted food, from every user. Optional case-insensitive name search. */
  /**
   * One capped page of matching foods, plus the totals behind it. The page cap exists because
   * the Open Food Facts import (#146) puts ~180k foods in the library; without the totals the
   * caller can only report the page size, which is not the library size.
   */
  async findAll(userId: string, search?: string): Promise<FoodListDto> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (search && search.trim()) {
      // Brand as well as name: the Open Food Facts import (#146) fills the library with
      // branded products a user is as likely to search for by brand.
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [foods, total, ownTotal, favoriteIds] = await Promise.all([
      this.prisma.food.findMany({
        where,
        include: WITH_PORTIONS,
        orderBy: { name: 'asc' },
        take: 200,
      }) as Promise<FoodRow[]>,
      this.prisma.food.count({ where }),
      this.prisma.food.count({ where: { ...where, source: 'USER', createdById: userId } }),
      this.favorites.favoriteFoodIds(userId),
    ]);

    return { items: foods.map((f) => toDto(f, userId, favoriteIds)), total, ownTotal };
  }

  /** Resolves a food by id even when it is soft-deleted -- old entries must keep rendering. */
  async findById(id: string, userId: string): Promise<FoodDto> {
    const [food, favoriteIds] = await Promise.all([
      this.prisma.food.findUnique({
        where: { id },
        include: WITH_PORTIONS,
      }) as Promise<FoodRow | null>,
      this.favorites.favoriteFoodIds(userId),
    ]);
    if (!food) {
      throw new NotFoundException('Lebensmittel nicht gefunden');
    }
    return toDto(food, userId, favoriteIds);
  }

  /**
   * Non-deleted foods for the given ids, as DTOs, returned in the order the ids were passed --
   * the nutrition picker's Favoriten / Zuletzt tabs decide the order and this preserves it. A
   * soft-deleted or missing id simply drops out (you cannot log it), so the result may be
   * shorter than `ids`.
   */
  async listByIds(userId: string, ids: string[]): Promise<FoodDto[]> {
    if (ids.length === 0) return [];
    const [foods, favoriteIds] = await Promise.all([
      this.prisma.food.findMany({
        where: { id: { in: ids }, deletedAt: null },
        include: WITH_PORTIONS,
      }) as Promise<FoodRow[]>,
      this.favorites.favoriteFoodIds(userId),
    ]);
    return orderByIds(ids, foods, (f) => f.id).map((f) => toDto(f, userId, favoriteIds));
  }

  /**
   * The current user's own foods whose name matches `name`, each with how many of the user's
   * diary entries reference it. Feeds the "similar entries" hint so duplicates are avoided.
   */
  async findSimilar(userId: string, name: string): Promise<SimilarFoodDto[]> {
    const query = (name ?? '').trim();
    if (query.length < 2) return [];

    const foods = (await this.prisma.food.findMany({
      where: {
        deletedAt: null,
        source: 'USER',
        createdById: userId,
        name: { contains: query, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      take: 6,
    })) as FoodRow[];
    if (foods.length === 0) return [];

    // Small result set -- only this user's entries that point at one of these <=6 foods.
    const entries = (await this.prisma.diaryEntry.findMany({
      where: { userId, foodId: { in: foods.map((f) => f.id) } },
      select: { foodId: true },
    })) as { foodId: string | null }[];
    const countByFood = new Map<string, number>();
    for (const entry of entries) {
      if (entry.foodId) {
        countByFood.set(entry.foodId, (countByFood.get(entry.foodId) ?? 0) + 1);
      }
    }

    return foods.map((f) => ({
      id: f.id,
      name: f.name,
      kcal: f.kcal,
      isLiquid: f.isLiquid,
      usageCount: countByFood.get(f.id) ?? 0,
    }));
  }

  /**
   * The barcode miss chain behind a scan or a manually typed EAN (#149):
   *
   *  1. **Local hit** -- a food in the library already claims this barcode. Answered from the
   *     library, with no network call. A *soft-deleted* row counts as a hit and comes back:
   *     the barcode is the product's global identity and is unique across deleted rows too, so
   *     the alternative is a 409 on a code the user is physically holding.
   *  2. **Open Food Facts** -- looked up live, cached as a global `OPEN_FOOD_FACTS` food with
   *     `lastSyncedAt` so the weekly sync (#150) treats it like any imported row.
   *  3. **Nothing** -- the caller opens "Lebensmittel anlegen" with the barcode prefilled.
   */
  async lookupByBarcode(userId: string, raw: string): Promise<BarcodeLookupDto> {
    const barcode = normalizeBarcode(raw);
    if (!barcode) {
      throw new BadRequestException('Kein gültiger EAN- oder UPC-Code');
    }

    const existing = (await this.prisma.food.findFirst({
      where: { barcode },
      include: WITH_PORTIONS,
    })) as FoodRow | null;
    if (existing) {
      const food = existing.deletedAt ? await this.undelete(existing.id) : existing;
      return {
        status: 'local',
        barcode,
        food: toDto(food, userId, await this.favorites.favoriteFoodIds(userId)),
      };
    }

    const product = await this.offLookup.lookup(barcode);
    if (!product) {
      return { status: 'notFound', barcode, food: null };
    }
    return { status: 'openFoodFacts', barcode, food: await this.cacheOffProduct(userId, product) };
  }

  /** A rescanned barcode brings its row back rather than colliding with the unique index. */
  private async undelete(id: string): Promise<FoodRow> {
    return (await this.prisma.food.update({
      where: { id },
      data: { deletedAt: null },
      include: WITH_PORTIONS,
    })) as FoodRow;
  }

  /**
   * Stores a live Open Food Facts hit as a global food, exactly as the bulk import writes one
   * (`off-import.ts`): no creator, `lastSyncedAt` stamped, read-only for everyone.
   *
   * Two scans of the same new barcode can both miss locally and both reach this write -- the
   * decode loop can fire twice before the first lookup returns. The loser of that race reads
   * back the row the winner wrote instead of surfacing the unique-constraint error.
   */
  private async cacheOffProduct(userId: string, product: MappedFood): Promise<FoodDto> {
    try {
      return await this.writeOffProduct(userId, product);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = (await this.prisma.food.findFirst({
        where: { barcode: product.barcode },
        include: WITH_PORTIONS,
      })) as FoodRow | null;
      if (!existing) throw error;
      return toDto(existing, userId);
    }
  }

  private async writeOffProduct(userId: string, product: MappedFood): Promise<FoodDto> {
    const food = (await this.prisma.food.create({
      data: {
        name: product.name,
        brand: product.brand,
        barcode: product.barcode,
        isLiquid: product.isLiquid,
        kcal: product.kcal,
        carbs: product.carbs,
        protein: product.protein,
        fat: product.fat,
        source: 'OPEN_FOOD_FACTS',
        createdById: null,
        lastSyncedAt: new Date(),
        portions: {
          create: product.portions.map((p, index) => ({
            label: p.label,
            grams: p.grams,
            order: index + 1,
            isDefault: p.isDefault,
          })),
        },
      },
      include: WITH_PORTIONS,
    })) as FoodRow;
    return toDto(food, userId);
  }

  async create(userId: string, dto: CreateFoodDto): Promise<FoodDto> {
    this.assertPortions(dto.portions);
    try {
      const food = (await this.prisma.food.create({
        data: {
          name: dto.name.trim(),
          brand: dto.brand?.trim() || null,
          barcode: dto.barcode?.trim() || null,
          isLiquid: dto.isLiquid ?? false,
          kcal: dto.kcal,
          carbs: dto.carbs,
          protein: dto.protein,
          fat: dto.fat,
          source: 'USER',
          createdById: userId,
          portions: { create: portionCreateData(dto.portions) },
        },
        include: WITH_PORTIONS,
      })) as FoodRow;
      return toDto(food, userId);
    } catch (error) {
      throw this.barcodeConflictOrRethrow(error);
    }
  }

  async update(userId: string, id: string, dto: UpdateFoodDto): Promise<FoodDto> {
    const food = (await this.prisma.food.findUnique({ where: { id } })) as FoodRow | null;
    if (!food || food.deletedAt) {
      throw new NotFoundException('Lebensmittel nicht gefunden');
    }
    this.assertEditable(food, userId);
    this.assertPortions(dto.portions);

    try {
      const updated = (await this.prisma.food.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          brand: dto.brand?.trim() || null,
          barcode: dto.barcode?.trim() || null,
          isLiquid: dto.isLiquid ?? false,
          kcal: dto.kcal,
          carbs: dto.carbs,
          protein: dto.protein,
          fat: dto.fat,
          // Rewrite the portion list wholesale: delete all, then recreate from the payload.
          portions: { deleteMany: {}, create: portionCreateData(dto.portions) },
        },
        include: WITH_PORTIONS,
      })) as FoodRow;
      return toDto(updated, userId, await this.favorites.favoriteFoodIds(userId));
    } catch (error) {
      throw this.barcodeConflictOrRethrow(error);
    }
  }

  /** Soft delete: the food leaves search but `findById` still resolves it. Creator only. */
  async softDelete(userId: string, id: string): Promise<void> {
    const food = (await this.prisma.food.findUnique({ where: { id } })) as FoodRow | null;
    if (!food || food.deletedAt) {
      throw new NotFoundException('Lebensmittel nicht gefunden');
    }
    this.assertEditable(food, userId);
    await this.prisma.food.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** SEED / OPEN_FOOD_FACTS are read-only for everyone; a USER food only for its creator. */
  private assertEditable(food: FoodRow, userId: string): void {
    if (food.source !== 'USER') {
      throw new ForbiddenException('Seed- und Open-Food-Facts-Einträge sind schreibgeschützt');
    }
    if (food.createdById !== userId) {
      throw new ForbiddenException('Nur der Ersteller kann dieses Lebensmittel ändern');
    }
  }

  private assertPortions(portions: FoodPortionInputDto[] | undefined): void {
    if (!portions || portions.length === 0) return;

    if (portions.some((p) => !p.label.trim() || !(p.grams > 0))) {
      throw new BadRequestException(
        'Jede Portionsgröße braucht eine Bezeichnung und eine Menge größer als 0',
      );
    }
    if (portions.filter((p) => p.isDefault).length !== 1) {
      throw new BadRequestException('Genau eine Portionsgröße muss als Standard markiert sein');
    }
  }

  private barcodeConflictOrRethrow(error: unknown): Error {
    if (isUniqueViolation(error)) {
      return new ConflictException('Ein Lebensmittel mit diesem Barcode existiert bereits');
    }
    return error as Error;
  }
}
