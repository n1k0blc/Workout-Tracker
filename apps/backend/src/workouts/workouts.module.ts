import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { WorkoutEngineService } from './workout-engine.service';

@Module({
  controllers: [WorkoutsController],
  providers: [WorkoutsService, WorkoutEngineService],
  exports: [WorkoutsService, WorkoutEngineService],
})
export class WorkoutsModule {}
