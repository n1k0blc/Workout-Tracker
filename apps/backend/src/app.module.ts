import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExercisesModule } from './exercises/exercises.module';
import { WorkoutCyclesModule } from './workout-cycles/workout-cycles.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    WorkoutCyclesModule,
    WorkoutsModule,
    AnalyticsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
