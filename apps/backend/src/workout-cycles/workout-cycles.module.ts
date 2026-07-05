import { Module } from '@nestjs/common';
import { WorkoutCyclesController } from './workout-cycles.controller';
import { WorkoutCyclesService } from './workout-cycles.service';
import { WorkoutTreeModule } from '../workout-tree/workout-tree.module';
import { ExercisesModule } from '../exercises/exercises.module';

@Module({
  imports: [WorkoutTreeModule, ExercisesModule],
  controllers: [WorkoutCyclesController],
  providers: [WorkoutCyclesService],
  exports: [WorkoutCyclesService],
})
export class WorkoutCyclesModule {}
