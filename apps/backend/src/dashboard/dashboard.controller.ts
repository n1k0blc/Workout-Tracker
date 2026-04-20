import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { NextPlannedWorkoutDto } from './dto/next-planned-workout.dto';
import { CycleProgressDto } from './dto/cycle-progress.dto';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats/current-week')
  async getCurrentWeekStats(
    @CurrentUser() user: { id: string },
  ): Promise<DashboardStatsDto> {
    return this.dashboardService.getLastSevenDaysStats(user.id);
  }

  @Get('next-planned-workout')
  async getNextPlannedWorkout(
    @CurrentUser() user: { id: string },
  ): Promise<NextPlannedWorkoutDto | null> {
    return this.dashboardService.getNextPlannedWorkout(user.id);
  }

  @Get('cycle-progress')
  async getCycleProgress(
    @CurrentUser() user: { id: string },
  ): Promise<CycleProgressDto | null> {
    return this.dashboardService.getCycleProgress(user.id);
  }
}
