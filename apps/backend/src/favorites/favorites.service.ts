import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A user's stars on shared Lebensmittel and Mahlzeiten (#148). Toggling is idempotent: the
 * `(userId, foodId)` / `(userId, mealId)` unique index turns a repeated star into a no-op and
 * an unstar of something not starred into a zero-row delete. Favoriting is only offered where
 * you log (the picker and the Zutat search), so a star always targets a non-deleted row --
 * the service still checks, and answers 404 otherwise.
 *
 * The id-set and list helpers feed everything downstream: `isFavorite` flags on the picker's
 * "Alle" rows (the Set helpers) and the "Favoriten" tab's last-use ordering (the list
 * helpers, whose `createdAt` is the tiebreaker for a never-logged favorite).
 */
@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async setFoodFavorite(userId: string, foodId: string, favorite: boolean): Promise<void> {
    if (favorite) {
      const food = await this.prisma.food.findFirst({
        where: { id: foodId, deletedAt: null },
        select: { id: true },
      });
      if (!food) {
        throw new NotFoundException('Lebensmittel nicht gefunden');
      }
      await this.prisma.foodFavorite.upsert({
        where: { userId_foodId: { userId, foodId } },
        create: { userId, foodId },
        update: {},
      });
    } else {
      await this.prisma.foodFavorite.deleteMany({ where: { userId, foodId } });
    }
  }

  async setMealFavorite(userId: string, mealId: string, favorite: boolean): Promise<void> {
    if (favorite) {
      const meal = await this.prisma.meal.findFirst({
        where: { id: mealId, deletedAt: null },
        select: { id: true },
      });
      if (!meal) {
        throw new NotFoundException('Mahlzeit nicht gefunden');
      }
      await this.prisma.mealFavorite.upsert({
        where: { userId_mealId: { userId, mealId } },
        create: { userId, mealId },
        update: {},
      });
    } else {
      await this.prisma.mealFavorite.deleteMany({ where: { userId, mealId } });
    }
  }

  async favoriteFoodIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.foodFavorite.findMany({
      where: { userId },
      select: { foodId: true },
    });
    return new Set(rows.map((r) => r.foodId));
  }

  async favoriteMealIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.mealFavorite.findMany({
      where: { userId },
      select: { mealId: true },
    });
    return new Set(rows.map((r) => r.mealId));
  }

  async listFoodFavorites(userId: string): Promise<{ foodId: string; createdAt: Date }[]> {
    return this.prisma.foodFavorite.findMany({
      where: { userId },
      select: { foodId: true, createdAt: true },
    });
  }

  async listMealFavorites(userId: string): Promise<{ mealId: string; createdAt: Date }[]> {
    return this.prisma.mealFavorite.findMany({
      where: { userId },
      select: { mealId: true, createdAt: true },
    });
  }
}
