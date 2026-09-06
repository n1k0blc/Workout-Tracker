import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from './config/env.validation';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExercisesModule } from './exercises/exercises.module';
import { WorkoutCyclesModule } from './workout-cycles/workout-cycles.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { WorkoutTemplatesModule } from './workout-templates/workout-templates.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate,
    }),
    // Global default: 100 req/min per client. Auth routes override with a much
    // stricter limit via @Throttle (brute-force protection on login/register).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    // Explicit, idempotent trigger for auto-completing expired cycles (§3.6) --
    // replaces the old write-on-read side-effect that ran inside GET handlers.
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    WorkoutCyclesModule,
    WorkoutsModule,
    WorkoutTemplatesModule,
    AnalyticsModule,
    HealthModule,
    DashboardModule,
    SecurityModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
