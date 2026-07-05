import { Module } from '@nestjs/common';
import { WorkoutTemplatesController } from './workout-templates.controller';
import { WorkoutTemplatesService } from './workout-templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkoutTreeModule } from '../workout-tree/workout-tree.module';
import { ExercisesModule } from '../exercises/exercises.module';

@Module({
  imports: [PrismaModule, WorkoutTreeModule, ExercisesModule],
  controllers: [WorkoutTemplatesController],
  providers: [WorkoutTemplatesService],
  exports: [WorkoutTemplatesService],
})
export class WorkoutTemplatesModule {}
