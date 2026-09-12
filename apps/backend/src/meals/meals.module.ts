import { Module } from '@nestjs/common';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';
import { FavoritesModule } from '../favorites/favorites.module';

@Module({
  imports: [FavoritesModule],
  controllers: [MealsController],
  providers: [MealsService],
  // NutritionModule uses this to expand a meal into snapshotted diary entries.
  exports: [MealsService],
})
export class MealsModule {}
