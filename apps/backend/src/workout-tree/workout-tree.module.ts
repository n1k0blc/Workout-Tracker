import { Module } from '@nestjs/common';
import { WorkoutTreeService } from './workout-tree.service';

@Module({
  providers: [WorkoutTreeService],
  exports: [WorkoutTreeService],
})
export class WorkoutTreeModule {}
