import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  VolumeAnalyticsDto,
  OneRMAnalyticsDto,
  PersonalRecordsDto,
  MuscleDistributionDto,
  TimeTrackingDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('volume')
  async getVolumeAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<VolumeAnalyticsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getVolumeAnalytics(user.id, period, start, end);
  }

  @Get('1rm/:exerciseId')
  async getOneRMAnalytics(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: { id: string },
  ): Promise<OneRMAnalyticsDto> {
    return this.analyticsService.getOneRMAnalytics(user.id, exerciseId);
  }

  @Get('prs')
  async getPersonalRecords(
    @CurrentUser() user: { id: string },
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
  ): Promise<PersonalRecordsDto> {
    return this.analyticsService.getPersonalRecords(user.id, muscleGroup, equipment);
  }

  @Get('muscle-distribution')
  async getMuscleDistribution(
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @CurrentUser() user: { id: string },
  ): Promise<MuscleDistributionDto> {
    return this.analyticsService.getMuscleDistribution(user.id, period);
  }

  @Get('time-tracking')
  async getTimeTracking(
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @CurrentUser() user: { id: string },
  ): Promise<TimeTrackingDto> {
    return this.analyticsService.getTimeTracking(user.id, period);
  }
}
