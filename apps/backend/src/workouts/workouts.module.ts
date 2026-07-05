import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { WorkoutEngineService } from './workout-engine.service';
import { WorkoutTreeModule } from '../workout-tree/workout-tree.module';
import { ExercisesModule } from '../exercises/exercises.module';

@Module({
  imports: [WorkoutTreeModule, ExercisesModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, WorkoutEngineService],
  exports: [WorkoutsService, WorkoutEngineService],
})
export class WorkoutsModule {}
