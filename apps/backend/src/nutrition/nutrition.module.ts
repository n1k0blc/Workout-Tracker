import { Module } from '@nestjs/common';
import { NutritionController } from './nutrition.controller';
import { MealSlotsService } from './meal-slots.service';
import { DiaryEntriesService } from './diary-entries.service';

@Module({
  controllers: [NutritionController],
  providers: [MealSlotsService, DiaryEntriesService],
  exports: [MealSlotsService],
})
export class NutritionModule {}
