import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { scalePer100 } from '../common/utils/nutrition.util';
import { MealsService } from '../meals/meals.service';
import { MealSlotsService } from './meal-slots.service';
import {
  toMacroTargetsDto,
  UserTargetsRow,
  USER_TARGETS_SELECT,
} from './nutrition-targets.util';
import {
  CreateDiaryEntryDto,
  CreateDiaryEntriesBatchDto,
  CreateDiaryEntriesFromMealDto,
  CopyDiaryDayDto,
  CopyDiarySlotDto,
  DiaryEntryDto,
  MacroTotals,
  NutritionDayDto,
  NutritionDaySlotDto,
} from './dto';

/** The Abschnitt a whole-day copy drops entries into when their own slot has been archived. */
const FALLBACK_SLOT_NAME = 'Sonstiges';

type DiaryEntryRow = {
  id: string;
  userId: string;
  mealSlotId: string;
  localDate: string;
  foodId: string | null;
  mealId: string | null;
  mealName: string | null;
  name: string;
  quantity: number;
  quantityLabel: string | null;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

type MealSlotRow = {
  id: string;
  name: string;
  order: number;
  archivedAt: Date | null;
};

type FoodRow = {
  id: string;
  name: string;
  isLiquid: boolean;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

const ZERO_TOTALS: MacroTotals = { kcal: 0, carbs: 0, protein: 0, fat: 0 };

function addNutrients(a: MacroTotals, e: DiaryEntryRow | DiaryEntryDto): MacroTotals {
  return {
    kcal: a.kcal + e.kcal,
    carbs: a.carbs + e.carbs,
    protein: a.protein + e.protein,
    fat: a.fat + e.fat,
  };
}

/** The nutrients of `grams` (or ml) of a food, scaled from its per-100 values. */
function scaleFromFood(food: FoodRow, grams: number) {
  return scalePer100(food, grams);
}

function toEntryDto(row: DiaryEntryRow): DiaryEntryDto {
  return {
    id: row.id,
    mealSlotId: row.mealSlotId,
    localDate: row.localDate,
    foodId: row.foodId,
    mealId: row.mealId,
    mealName: row.mealName,
    name: row.name,
    quantity: row.quantity,
    quantityLabel: row.quantityLabel,
    kcal: row.kcal,
    carbs: row.carbs,
    protein: row.protein,
    fat: row.fat,
  };
}

@Injectable()
export class DiaryEntriesService {
  constructor(
    private prisma: PrismaService,
    private meals: MealsService,
    private mealSlots: MealSlotsService,
  ) {}

  /** A source entry, re-cast as a fresh snapshot for `localDate` / `mealSlotId` (#151, ADR-0002). */
  private static copyOf(
    entry: DiaryEntryRow,
    userId: string,
    localDate: string,
    mealSlotId: string,
  ) {
    return {
      userId,
      mealSlotId,
      localDate,
      foodId: entry.foodId,
      mealId: entry.mealId,
      mealName: entry.mealName,
      name: entry.name,
      quantity: entry.quantity,
      quantityLabel: entry.quantityLabel,
      kcal: entry.kcal,
      carbs: entry.carbs,
      protein: entry.protein,
      fat: entry.fat,
    };
  }

  /**
   * The Tagesansicht read model for one calendar day: every Abschnitt the user has, each with
   * that day's entries and their totals, plus the whole-day totals. An archived Abschnitt
   * (#142) is included only when it already holds entries for `localDate`, so opening an old
   * day still shows what was eaten there. The user's Tagesziele (#152) ride along so the
   * client can render the consumed-vs-target card without a second request.
   */
  async getDay(userId: string, localDate: string): Promise<NutritionDayDto> {
    const [slots, entries, targetsRow] = await Promise.all([
      this.prisma.mealSlot.findMany({
        where: { userId },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, order: true, archivedAt: true },
      }) as Promise<MealSlotRow[]>,
      this.prisma.diaryEntry.findMany({
        where: { userId, localDate },
        orderBy: { createdAt: 'asc' },
      }) as Promise<DiaryEntryRow[]>,
      this.prisma.user.findUnique({
        where: { id: userId },
        select: USER_TARGETS_SELECT,
      }) as Promise<UserTargetsRow | null>,
    ]);

    const entriesBySlot = new Map<string, DiaryEntryRow[]>();
    for (const entry of entries) {
      const list = entriesBySlot.get(entry.mealSlotId) ?? [];
      list.push(entry);
      entriesBySlot.set(entry.mealSlotId, list);
    }

    const slotDtos: NutritionDaySlotDto[] = [];
    for (const slot of slots) {
      const slotEntries = entriesBySlot.get(slot.id) ?? [];
      if (slot.archivedAt && slotEntries.length === 0) continue;
      slotDtos.push({
        id: slot.id,
        name: slot.name,
        order: slot.order,
        archived: slot.archivedAt !== null,
        totals: slotEntries.reduce(addNutrients, { ...ZERO_TOTALS }),
        entries: slotEntries.map(toEntryDto),
      });
    }

    return {
      date: localDate,
      totals: entries.reduce(addNutrients, { ...ZERO_TOTALS }),
      targets: toMacroTargetsDto(targetsRow),
      slots: slotDtos,
    };
  }

  /**
   * Logs a Schnelleintrag: the given name and kcal/macros are stored verbatim as the snapshot,
   * with `mealId` null. `foodId` is null too, unless `saveAsFood` is set -- then the entered
   * values are also saved as a new USER Lebensmittel (as its per-100 values) and this entry
   * references it. `quantity` defaults to 1 when the client omits it.
   */
  async createEntry(userId: string, dto: CreateDiaryEntryDto): Promise<DiaryEntryDto> {
    await this.assertWritableSlot(userId, dto.mealSlotId);

    const entryData = {
      userId,
      mealSlotId: dto.mealSlotId,
      localDate: dto.localDate,
      name: dto.name,
      mealId: null,
      mealName: null,
      quantity: dto.quantity ?? 1,
      quantityLabel: dto.quantityLabel ?? null,
      kcal: dto.kcal,
      carbs: dto.carbs,
      protein: dto.protein,
      fat: dto.fat,
    };

    if (!dto.saveAsFood) {
      const entry = (await this.prisma.diaryEntry.create({
        data: { ...entryData, foodId: null },
      })) as DiaryEntryRow;
      return toEntryDto(entry);
    }

    // Save-as-food: the entered numbers become a new USER food's per-100 values, and the
    // entry points at it. Both writes in one transaction so a failure leaves neither.
    const entry = await this.prisma.$transaction(async (tx) => {
      const food = await tx.food.create({
        data: {
          name: dto.name.trim(),
          source: 'USER',
          createdById: userId,
          isLiquid: false,
          kcal: dto.kcal,
          carbs: dto.carbs,
          protein: dto.protein,
          fat: dto.fat,
        },
      });
      return tx.diaryEntry.create({ data: { ...entryData, foodId: food.id } });
    });

    return toEntryDto(entry as DiaryEntryRow);
  }

  /**
   * Commits the picker's basket (#144): every collected food becomes one Eintrag in the same
   * Abschnitt on the same day, in a single write. Each entry's kcal/Kohlenhydrate/Protein/Fett
   * are scaled from the food's per-100 values by `grams / 100` and frozen -- editing the food
   * afterwards never changes them (ADR-0002).
   */
  async createFromFoodBatch(
    userId: string,
    dto: CreateDiaryEntriesBatchDto,
  ): Promise<{ count: number }> {
    await this.assertWritableSlot(userId, dto.mealSlotId);

    const foodIds = Array.from(new Set(dto.items.map((i) => i.foodId)));
    const foods = (await this.prisma.food.findMany({
      where: { id: { in: foodIds }, deletedAt: null },
      select: {
        id: true,
        name: true,
        isLiquid: true,
        kcal: true,
        carbs: true,
        protein: true,
        fat: true,
      },
    })) as FoodRow[];
    const foodById = new Map(foods.map((f) => [f.id, f]));
    if (foodById.size !== foodIds.length) {
      throw new NotFoundException('Ein Lebensmittel wurde nicht gefunden');
    }

    const data = dto.items.map((item) => {
      const food = foodById.get(item.foodId)!;
      const unit = food.isLiquid ? 'ml' : 'g';
      return {
        userId,
        mealSlotId: dto.mealSlotId,
        localDate: dto.localDate,
        foodId: food.id,
        mealId: null,
        mealName: null,
        name: food.name,
        quantity: item.grams,
        quantityLabel: item.quantityLabel ?? `${Math.round(item.grams)} ${unit}`,
        ...scaleFromFood(food, item.grams),
      };
    });

    return this.prisma.diaryEntry.createMany({ data });
  }

  /**
   * Logs a Mahlzeit (#147): expands it into one Eintrag per ingredient in the given Abschnitt
   * on the given day, in a single write. Each ingredient's amount is `quantity * factor` and
   * its kcal/Kohlenhydrate/Protein/Fett are scaled from the food's *current* per-100 values
   * and frozen -- a later edit to the food or the meal never changes these entries (ADR-0002).
   * Every entry carries the meal's id as a grouping tag, so the Abschnitt page can group them
   * under the meal's name. A soft-deleted ingredient food still expands and computes.
   */
  async createFromMeal(
    userId: string,
    dto: CreateDiaryEntriesFromMealDto,
  ): Promise<{ count: number }> {
    await this.assertWritableSlot(userId, dto.mealSlotId);

    const meal = await this.meals.findById(dto.mealId, userId);
    if (meal.deleted) {
      throw new NotFoundException('Mahlzeit nicht gefunden');
    }

    const data = meal.items.map((item) => {
      const amount = item.quantity * dto.factor;
      const unit = item.isLiquid ? 'ml' : 'g';
      return {
        userId,
        mealSlotId: dto.mealSlotId,
        localDate: dto.localDate,
        foodId: item.foodId,
        mealId: meal.id,
        mealName: meal.name,
        name: item.foodName,
        quantity: amount,
        quantityLabel: `${Math.round(amount)} ${unit}`,
        ...scalePer100(item.per100, amount),
      };
    });

    return this.prisma.diaryEntry.createMany({ data });
  }

  /**
   * The calendar days the user has logged something on, most recent first. "Von einem
   * anderen Tag kopieren" (#151) offers only these in its date picker, so there is never a
   * copy from an empty day. `exclude` drops the day the picker was opened on.
   */
  async listCopySourceDates(userId: string, exclude?: string): Promise<string[]> {
    const rows = (await this.prisma.diaryEntry.findMany({
      where: { userId, ...(exclude ? { localDate: { not: exclude } } : {}) },
      distinct: ['localDate'],
      select: { localDate: true },
      orderBy: { localDate: 'desc' },
    })) as { localDate: string }[];
    return rows.map((r) => r.localDate);
  }

  /**
   * Copies one Abschnitt's entries from `fromDate` into the same Abschnitt on `toDate` (#151).
   * Each copy is a fresh snapshot of the source entry -- name, quantity and kcal/macros
   * carried over verbatim, `mealId` / `mealName` kept so a copied Mahlzeit stays grouped
   * (ADR-0002). The target Abschnitt must be the user's and not archived.
   */
  async copySlot(userId: string, dto: CopyDiarySlotDto): Promise<{ count: number }> {
    this.assertDistinctDays(dto.fromDate, dto.toDate);
    await this.assertWritableSlot(userId, dto.mealSlotId);

    const source = (await this.prisma.diaryEntry.findMany({
      where: { userId, localDate: dto.fromDate, mealSlotId: dto.mealSlotId },
      orderBy: { createdAt: 'asc' },
    })) as DiaryEntryRow[];
    if (source.length === 0) {
      return { count: 0 };
    }

    return this.prisma.diaryEntry.createMany({
      data: source.map((e) =>
        DiaryEntriesService.copyOf(e, userId, dto.toDate, dto.mealSlotId),
      ),
    });
  }

  /**
   * Copies every entry of `fromDate` onto `toDate` (#151), each staying in its own Abschnitt.
   * An entry whose Abschnitt has since been archived would land in a read-only slot and
   * disappear from the day, so those entries are redirected into a visible "Sonstiges"
   * Abschnitt, created on demand. Copies are fresh snapshots, exactly as {@link copySlot}.
   */
  async copyDay(userId: string, dto: CopyDiaryDayDto): Promise<{ count: number }> {
    this.assertDistinctDays(dto.fromDate, dto.toDate);

    const [source, slots] = await Promise.all([
      this.prisma.diaryEntry.findMany({
        where: { userId, localDate: dto.fromDate },
        orderBy: { createdAt: 'asc' },
      }) as Promise<DiaryEntryRow[]>,
      this.prisma.mealSlot.findMany({
        where: { userId },
        select: { id: true, archivedAt: true },
      }) as Promise<{ id: string; archivedAt: Date | null }[]>,
    ]);
    if (source.length === 0) {
      return { count: 0 };
    }

    const activeSlotIds = new Set(
      slots.filter((s) => s.archivedAt === null).map((s) => s.id),
    );
    const needsFallback = source.some((e) => !activeSlotIds.has(e.mealSlotId));
    const fallbackSlotId = needsFallback
      ? (await this.mealSlots.ensureActiveSlot(userId, FALLBACK_SLOT_NAME)).id
      : null;

    return this.prisma.diaryEntry.createMany({
      data: source.map((e) => {
        const targetSlotId = activeSlotIds.has(e.mealSlotId)
          ? e.mealSlotId
          : fallbackSlotId!;
        return DiaryEntriesService.copyOf(e, userId, dto.toDate, targetSlotId);
      }),
    });
  }

  private assertDistinctDays(fromDate: string, toDate: string): void {
    if (fromDate === toDate) {
      throw new BadRequestException('Quell- und Zieltag sind identisch');
    }
  }

  /**
   * Rescales an Eintrag's snapshot proportionally to a new quantity: every nutrient is
   * multiplied by newQuantity / oldQuantity. The snapshot is never recomputed from a Food --
   * that is the whole point of storing it (see ADR-0002). Scoped to `userId`: another user's
   * entry is a 404, never a silent edit.
   */
  async updateEntryQuantity(
    userId: string,
    id: string,
    quantity: number,
    quantityLabel?: string,
  ): Promise<DiaryEntryDto> {
    const entry = (await this.prisma.diaryEntry.findFirst({
      where: { id, userId },
    })) as DiaryEntryRow | null;
    if (!entry) {
      throw new NotFoundException('Eintrag nicht gefunden');
    }

    const ratio = quantity / entry.quantity;
    const updated = (await this.prisma.diaryEntry.update({
      where: { id },
      data: {
        quantity,
        kcal: entry.kcal * ratio,
        carbs: entry.carbs * ratio,
        protein: entry.protein * ratio,
        fat: entry.fat * ratio,
        // Only a food-backed editor sends this; a bare Schnelleintrag has no unit label.
        ...(quantityLabel !== undefined ? { quantityLabel } : {}),
      },
    })) as DiaryEntryRow;

    return toEntryDto(updated);
  }

  /**
   * Hard-deletes an Eintrag. The undo toast restores it by re-creating from the client's copy,
   * so there is no soft-delete state to carry. Scoped to `userId`.
   */
  async deleteEntry(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.diaryEntry.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException('Eintrag nicht gefunden');
    }
  }

  /** The Abschnitt must be the user's and not archived -- archived slots are read-only (#142). */
  private async assertWritableSlot(userId: string, mealSlotId: string): Promise<void> {
    const slot = await this.prisma.mealSlot.findFirst({
      where: { id: mealSlotId, userId },
      select: { id: true, archivedAt: true },
    });
    if (!slot) {
      throw new NotFoundException('Abschnitt nicht gefunden');
    }
    if (slot.archivedAt) {
      throw new ConflictException('Abschnitt ist archiviert');
    }
  }
}
