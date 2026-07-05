import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  VolumeAnalyticsDto,
  PersonalRecordsDto,
  MuscleDistributionDto,
  CycleListDto,
  RIRAnalyticsDto,
  DurationAnalyticsDto,
  RestTimeAnalyticsDto,
  RepsAnalyticsDto,
  SetsAnalyticsDto,
  IntensityAnalyticsDto,
} from './dto';
import { AnalyticsFilterDto } from '../common/dto/analytics-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * PR3 (§3.9): consolidated down from 18 routes (9 metrics x base+"-by-cycle" twin, minus the
 * 3 dropped ORM routes) to one route per metric. `filter.cycleId` presence alone switches a
 * metric into cycle-anchored mode -- see `AnalyticsService.loadWorkoutsForAnalytics`.
 */
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('volume')
  async getVolumeAnalytics(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<VolumeAnalyticsDto> {
    return this.analyticsService.getVolumeAnalytics(user.id, filter);
  }

  @Get('prs')
  async getPersonalRecords(
    @CurrentUser() user: { id: string },
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('gymId') gymId?: string,
  ): Promise<PersonalRecordsDto> {
    return this.analyticsService.getPersonalRecords(user.id, muscleGroup, equipment, gymId);
  }

  @Get('muscle-distribution')
  async getMuscleDistribution(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<MuscleDistributionDto> {
    return this.analyticsService.getMuscleDistribution(user.id, filter);
  }

  @Get('cycles')
  async getCycles(@CurrentUser() user: { id: string }): Promise<CycleListDto> {
    return this.analyticsService.getCycles(user.id);
  }

  @Get('rir')
  async getRIRAnalytics(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<RIRAnalyticsDto> {
    return this.analyticsService.getRIRAnalytics(user.id, filter);
  }

  @Get('duration')
  async getDurationAnalytics(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<DurationAnalyticsDto> {
    return this.analyticsService.getDurationAnalytics(user.id, filter);
  }

  @Get('rest-time')
  async getRestTimeAnalytics(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<RestTimeAnalyticsDto> {
    return this.analyticsService.getRestTimeAnalytics(user.id, filter);
  }

  @Get('reps')
  async getRepsAnalytics(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<RepsAnalyticsDto> {
    return this.analyticsService.getRepsAnalytics(user.id, filter);
  }

  @Get('sets')
  async getSetsAnalytics(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<SetsAnalyticsDto> {
    return this.analyticsService.getSetsAnalytics(user.id, filter);
  }

  @Get('intensity')
  async getIntensityAnalytics(
    @CurrentUser() user: { id: string },
    @Query() filter: AnalyticsFilterDto,
  ): Promise<IntensityAnalyticsDto> {
    return this.analyticsService.getIntensityAnalytics(user.id, filter);
  }
}
