import { Module } from '@nestjs/common';
import { NutritionController } from './nutrition.controller';
import { MealSlotsService } from './meal-slots.service';
import { DiaryEntriesService } from './diary-entries.service';
import { NutritionAnalyticsService } from './nutrition-analytics.service';
import { PickerService } from './picker.service';
import { MealsModule } from '../meals/meals.module';
import { FoodsModule } from '../foods/foods.module';
import { FavoritesModule } from '../favorites/favorites.module';

@Module({
  imports: [MealsModule, FoodsModule, FavoritesModule],
  controllers: [NutritionController],
  providers: [
    MealSlotsService,
    DiaryEntriesService,
    NutritionAnalyticsService,
    PickerService,
  ],
  exports: [MealSlotsService],
})
export class NutritionModule {}
