import { Module } from '@nestjs/common';
import { NutritionController } from './nutrition.controller';
import { MealSlotsService } from './meal-slots.service';
import { DiaryEntriesService } from './diary-entries.service';
import { MealsModule } from '../meals/meals.module';

@Module({
  imports: [MealsModule],
  controllers: [NutritionController],
  providers: [MealSlotsService, DiaryEntriesService],
  exports: [MealSlotsService],
})
export class NutritionModule {}
