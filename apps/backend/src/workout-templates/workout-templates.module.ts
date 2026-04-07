import { Module } from '@nestjs/common';
import { WorkoutTemplatesController } from './workout-templates.controller';
import { WorkoutTemplatesService } from './workout-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkoutTemplatesController],
  providers: [WorkoutTemplatesService],
  exports: [WorkoutTemplatesService],
})
export class WorkoutTemplatesModule {}
