import { Module } from '@nestjs/common';
import { WorkoutCyclesController } from './workout-cycles.controller';
import { WorkoutCyclesService } from './workout-cycles.service';

@Module({
  controllers: [WorkoutCyclesController],
  providers: [WorkoutCyclesService],
  exports: [WorkoutCyclesService],
})
export class WorkoutCyclesModule {}
