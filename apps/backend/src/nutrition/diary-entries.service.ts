import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDiaryEntryDto,
  CreateDiaryEntriesBatchDto,
  DiaryEntryDto,
  MacroTotals,
  NutritionDayDto,
  NutritionDaySlotDto,
} from './dto';

type DiaryEntryRow = {
  id: string;
  userId: string;
  mealSlotId: string;
  localDate: string;
  foodId: string | null;
  mealId: string | null;
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
  const factor = grams / 100;
  return {
    kcal: food.kcal * factor,
    carbs: food.carbs * factor,
    protein: food.protein * factor,
    fat: food.fat * factor,
  };
}

function toEntryDto(row: DiaryEntryRow): DiaryEntryDto {
  return {
    id: row.id,
    mealSlotId: row.mealSlotId,
    localDate: row.localDate,
    foodId: row.foodId,
    mealId: row.mealId,
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
  constructor(private prisma: PrismaService) {}

  /**
   * The Tagesansicht read model for one calendar day: every Abschnitt the user has, each with
   * that day's entries and their totals, plus the whole-day totals. An archived Abschnitt
   * (#142) is included only when it already holds entries for `localDate`, so opening an old
   * day still shows what was eaten there.
   */
  async getDay(userId: string, localDate: string): Promise<NutritionDayDto> {
    const [slots, entries] = await Promise.all([
      this.prisma.mealSlot.findMany({
        where: { userId },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, order: true, archivedAt: true },
      }) as Promise<MealSlotRow[]>,
      this.prisma.diaryEntry.findMany({
        where: { userId, localDate },
        orderBy: { createdAt: 'asc' },
      }) as Promise<DiaryEntryRow[]>,
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
        name: food.name,
        quantity: item.grams,
        quantityLabel: item.quantityLabel ?? `${Math.round(item.grams)} ${unit}`,
        ...scaleFromFood(food, item.grams),
      };
    });

    return this.prisma.diaryEntry.createMany({ data });
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
