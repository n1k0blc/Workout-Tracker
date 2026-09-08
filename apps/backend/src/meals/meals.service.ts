import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { scalePer100 } from '../common/utils/nutrition.util';
import {
  CreateMealDto,
  UpdateMealDto,
  MealItemInputDto,
  MealDto,
  MealListDto,
  MealMacroTotals,
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
  isLiquid: boolean;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  deletedAt: Date | null;
  portions: PortionRow[];
};

type MealItemRow = {
  id: string;
  foodId: string;
  quantity: number;
  order: number;
  food: FoodRow;
};

type MealRow = {
  id: string;
  name: string;
  createdById: string | null;
  deletedAt: Date | null;
  items: MealItemRow[];
};

/** Just the fields the owner / not-deleted checks read, before an item-less update write. */
type MealCheckRow = Pick<MealRow, 'id' | 'createdById' | 'deletedAt'>;

const WITH_ITEMS = {
  items: {
    orderBy: { order: 'asc' as const },
    include: { food: { include: { portions: { orderBy: { order: 'asc' as const } } } } },
  },
};

const ZERO: MealMacroTotals = { kcal: 0, carbs: 0, protein: 0, fat: 0 };

/**
 * A meal's totals, per 1x, computed live from the *current* nutrients of the foods it points
 * at. Editing a food changes this number; entries already logged from the meal do not change
 * (they snapshotted -- ADR-0002). A soft-deleted food still contributes.
 */
function computeTotals(items: MealItemRow[]): MealMacroTotals {
  return items.reduce((sum, item) => {
    const part = scalePer100(item.food, item.quantity);
    return {
      kcal: sum.kcal + part.kcal,
      carbs: sum.carbs + part.carbs,
      protein: sum.protein + part.protein,
      fat: sum.fat + part.fat,
    };
  }, { ...ZERO });
}

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Every non-deleted Mahlzeit, from every user (ADR-0003 -- meals are a shared library like
   * foods). `mineOnly` narrows to the caller's own for the tab's "Nur meine" filter. The list
   * carries the two counts the tab's count line needs: how many match, and how many the
   * caller created.
   */
  async findAll(userId: string, mineOnly = false): Promise<MealListDto> {
    // No page cap and the counts come off the array, unlike FoodsService.findAll: the meal
    // library is hand-built and bounded (dozens per user), not the ~180k of the Open Food
    // Facts import. `total` / `mineTotal` always describe the whole library so the tab's
    // count line stays put when "Nur meine" filters the list below it.
    const all = (await this.prisma.meal.findMany({
      where: { deletedAt: null },
      include: WITH_ITEMS,
      orderBy: { name: 'asc' },
    })) as MealRow[];
    const mine = all.filter((m) => m.createdById === userId);

    return {
      items: (mineOnly ? mine : all).map((meal) => ({
        id: meal.id,
        name: meal.name,
        editable: this.isEditable(meal, userId),
        itemCount: meal.items.length,
        ingredientNames: meal.items.map((i) => i.food.name),
        totals: computeTotals(meal.items),
      })),
      total: all.length,
      mineTotal: mine.length,
    };
  }

  /** One Mahlzeit with its ingredients resolved and its totals computed live. */
  async findById(id: string, userId: string): Promise<MealDto> {
    const meal = (await this.prisma.meal.findUnique({
      where: { id },
      include: WITH_ITEMS,
    })) as MealRow | null;
    if (!meal) {
      throw new NotFoundException('Mahlzeit nicht gefunden');
    }
    return this.toDto(meal, userId);
  }

  async create(userId: string, dto: CreateMealDto): Promise<MealDto> {
    await this.assertFoodsExist(dto.items);
    const meal = (await this.prisma.meal.create({
      data: {
        name: dto.name.trim(),
        createdById: userId,
        items: { create: itemCreateData(dto.items) },
      },
      include: WITH_ITEMS,
    })) as MealRow;
    return this.toDto(meal, userId);
  }

  async update(userId: string, id: string, dto: UpdateMealDto): Promise<MealDto> {
    const meal = (await this.prisma.meal.findUnique({
      where: { id },
    })) as MealCheckRow | null;
    if (!meal || meal.deletedAt) {
      throw new NotFoundException('Mahlzeit nicht gefunden');
    }
    this.assertOwner(meal, userId);
    await this.assertFoodsExist(dto.items);

    const updated = (await this.prisma.meal.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        // Rewrite the item list wholesale, like the food editor does with portions: delete
        // all, recreate from the payload so `order` stays contiguous from array position.
        items: { deleteMany: {}, create: itemCreateData(dto.items) },
      },
      include: WITH_ITEMS,
    })) as MealRow;
    return this.toDto(updated, userId);
  }

  /** Soft delete: the meal leaves the list but `findById` still resolves it, and entries
   * already logged from it keep grouping under its name. Creator only. */
  async softDelete(userId: string, id: string): Promise<void> {
    const meal = (await this.prisma.meal.findUnique({
      where: { id },
    })) as MealCheckRow | null;
    if (!meal || meal.deletedAt) {
      throw new NotFoundException('Mahlzeit nicht gefunden');
    }
    this.assertOwner(meal, userId);
    await this.prisma.meal.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private toDto(meal: MealRow, userId: string): MealDto {
    return {
      id: meal.id,
      name: meal.name,
      editable: this.isEditable(meal, userId),
      deleted: meal.deletedAt !== null,
      items: meal.items.map((item) => ({
        id: item.id,
        foodId: item.foodId,
        order: item.order,
        quantity: item.quantity,
        foodName: item.food.name,
        isLiquid: item.food.isLiquid,
        deleted: item.food.deletedAt !== null,
        per100: {
          kcal: item.food.kcal,
          carbs: item.food.carbs,
          protein: item.food.protein,
          fat: item.food.fat,
        },
        portions: item.food.portions.map((p) => ({
          id: p.id,
          label: p.label,
          grams: p.grams,
          order: p.order,
          isDefault: p.isDefault,
        })),
      })),
      totals: computeTotals(meal.items),
    };
  }

  private isEditable(meal: MealRow, userId: string): boolean {
    return meal.createdById === userId && meal.deletedAt === null;
  }

  private assertOwner(meal: MealCheckRow, userId: string): void {
    if (meal.createdById !== userId) {
      throw new ForbiddenException('Nur der Ersteller kann diese Mahlzeit ändern');
    }
  }

  /** Every referenced food must exist (soft-deleted is fine -- ADR-0003). */
  private async assertFoodsExist(items: MealItemInputDto[]): Promise<void> {
    const ids = Array.from(new Set(items.map((i) => i.foodId)));
    const found = await this.prisma.food.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      throw new NotFoundException('Ein Lebensmittel wurde nicht gefunden');
    }
  }
}

/** `{ foodId, quantity, order }` rows, `order` written from array position. */
function itemCreateData(items: MealItemInputDto[]) {
  return items.map((item, index) => ({
    foodId: item.foodId,
    quantity: item.quantity,
    order: index + 1,
  }));
}
