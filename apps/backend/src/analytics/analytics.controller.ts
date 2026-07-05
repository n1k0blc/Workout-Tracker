import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  VolumeAnalyticsDto,
  PersonalRecordsDto,
  MuscleDistributionDto,
  TimeTrackingDto,
  CycleListDto,
  RIRByCycleDto,
  RIRAnalyticsDto,
  DurationAnalyticsDto,
  DurationByCycleDto,
  RestTimeAnalyticsDto,
  RestTimeByCycleDto,
  RepsAnalyticsDto,
  RepsByCycleDto,
  SetsAnalyticsDto,
  SetsByCycleDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// getOneRMAnalytics/getORMAnalytics/getORMByCycle are gone (§3.10): ExerciseBenchmark is
// dropped in PR2; the replacement weight-independent Intensity metric lands in PR3.
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
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('cycleId') cycleId?: string,
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<VolumeAnalyticsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getVolumeAnalytics(
      user.id,
      period,
      start,
      end,
      gymId,
      muscleGroup,
      equipment,
      cycleId,
      aggregation,
      exerciseId,
    );
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
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('gymId') gymId?: string,
  ): Promise<MuscleDistributionDto> {
    return this.analyticsService.getMuscleDistribution(user.id, period, gymId);
  }

  @Get('time-tracking')
  async getTimeTracking(
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @CurrentUser() user: { id: string },
  ): Promise<TimeTrackingDto> {
    return this.analyticsService.getTimeTracking(user.id, period);
  }

  @Get('cycles')
  async getCycles(
    @CurrentUser() user: { id: string },
  ): Promise<CycleListDto> {
    return this.analyticsService.getCycles(user.id);
  }

  @Get('rir-by-cycle/:cycleId')
  async getRIRByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('timeOfDay') timeOfDay?: string,
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<RIRByCycleDto> {
    return this.analyticsService.getRIRByCycle(user.id, cycleId, gymId, muscleGroup, equipment, timeOfDay, aggregation, exerciseId);
  }

  @Get('rir')
  async getRIRAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<RIRAnalyticsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getRIRAnalytics(
      user.id,
      period,
      start,
      end,
      gymId,
      muscleGroup,
      equipment,
      aggregation,
      exerciseId,
    );
  }

  @Get('duration')
  async getDurationAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
  ): Promise<DurationAnalyticsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getDurationAnalytics(
      user.id,
      period,
      start,
      end,
      gymId,
      muscleGroup,
      equipment,
      aggregation,
    );
  }

  @Get('duration-by-cycle/:cycleId')
  async getDurationByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
  ): Promise<DurationByCycleDto> {
    return this.analyticsService.getDurationByCycle(user.id, cycleId, gymId, muscleGroup, equipment, aggregation);
  }

  @Get('rest-time')
  async getRestTimeAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<RestTimeAnalyticsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getRestTimeAnalytics(
      user.id,
      period,
      start,
      end,
      gymId,
      muscleGroup,
      equipment,
      aggregation,
      exerciseId,
    );
  }

  @Get('rest-time-by-cycle/:cycleId')
  async getRestTimeByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<RestTimeByCycleDto> {
    return this.analyticsService.getRestTimeByCycle(user.id, cycleId, gymId, muscleGroup, equipment, aggregation, exerciseId);
  }

  @Get('reps')
  async getRepsAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period?: 'week' | 'month' | 'all',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<RepsAnalyticsDto> {
    return this.analyticsService.getRepsAnalytics(
      user.id,
      period,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      gymId,
      muscleGroup,
      equipment,
      aggregation,
      exerciseId,
    );
  }

  @Get('reps-by-cycle/:cycleId')
  async getRepsByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<RepsByCycleDto> {
    return this.analyticsService.getRepsByCycle(user.id, cycleId, muscleGroup, equipment, aggregation, exerciseId);
  }

  @Get('sets')
  async getSetsAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period?: 'week' | 'month' | 'all',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<SetsAnalyticsDto> {
    return this.analyticsService.getSetsAnalytics(
      user.id,
      period,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      gymId,
      muscleGroup,
      equipment,
      aggregation,
      exerciseId,
    );
  }

  @Get('sets-by-cycle/:cycleId')
  async getSetsByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('muscleGroup') muscleGroup?: string | string[],
    @Query('equipment') equipment?: string | string[],
    @Query('aggregation') aggregation?: 'day' | 'week',
    @Query('exerciseId') exerciseId?: string,
  ): Promise<SetsByCycleDto> {
    return this.analyticsService.getSetsByCycle(user.id, cycleId, muscleGroup, equipment, aggregation, exerciseId);
  }
}
