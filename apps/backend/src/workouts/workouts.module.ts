import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { WorkoutEngineService } from './workout-engine.service';
import { ORMModule } from '../orm/orm.module';

@Module({
  imports: [ORMModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, WorkoutEngineService],
  exports: [WorkoutsService, WorkoutEngineService],
})
export class WorkoutsModule {}
