import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ORMService } from '../orm/orm.service';
import {
  VolumeAnalyticsDto,
  OneRMAnalyticsDto,
  PersonalRecordsDto,
  MuscleDistributionDto,
  TimeTrackingDto,
  CycleListDto,
  ORMByCycleDto,
  RIRByCycleDto,
  RIRAnalyticsDto,
  DurationAnalyticsDto,
  DurationByCycleDto,
  RestTimeAnalyticsDto,
  RestTimeByCycleDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly ormService: ORMService,
  ) {}

  @Get('volume')
  async getVolumeAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
    @Query('cycleId') cycleId?: string,
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
    );
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

  @Get('orm/:cycleId/:workoutDayId')
  async getORMAnalytics(
    @Param('cycleId') cycleId: string,
    @Param('workoutDayId') workoutDayId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.analyticsService.getORMAnalytics(cycleId, workoutDayId, user.id);
  }

  @Get('cycles')
  async getCycles(
    @CurrentUser() user: { id: string },
  ): Promise<CycleListDto> {
    return this.analyticsService.getCycles(user.id);
  }

  @Get('orm-by-cycle/:cycleId')
  async getORMByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
  ): Promise<ORMByCycleDto> {
    return this.analyticsService.getORMByCycle(user.id, cycleId, muscleGroup, equipment);
  }

  @Get('rir-by-cycle/:cycleId')
  async getRIRByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
    @Query('timeOfDay') timeOfDay?: string,
  ): Promise<RIRByCycleDto> {
    return this.analyticsService.getRIRByCycle(user.id, cycleId, gymId, muscleGroup, equipment, timeOfDay);
  }

  @Get('rir')
  async getRIRAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
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
    );
  }

  @Get('duration')
  async getDurationAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
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
    );
  }

  @Get('duration-by-cycle/:cycleId')
  async getDurationByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
  ): Promise<DurationByCycleDto> {
    return this.analyticsService.getDurationByCycle(user.id, cycleId, gymId, muscleGroup, equipment);
  }

  @Get('rest-time')
  async getRestTimeAnalytics(
    @CurrentUser() user: { id: string },
    @Query('period') period: 'week' | 'month' | 'all' = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
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
    );
  }

  @Get('rest-time-by-cycle/:cycleId')
  async getRestTimeByCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: { id: string },
    @Query('gymId') gymId?: string,
    @Query('muscleGroup') muscleGroup?: string,
    @Query('equipment') equipment?: string,
  ): Promise<RestTimeByCycleDto> {
    return this.analyticsService.getRestTimeByCycle(user.id, cycleId, gymId, muscleGroup, equipment);
  }
}
