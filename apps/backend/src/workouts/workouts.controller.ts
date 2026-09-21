import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppBadRequestException } from '../common/errors/app-exceptions';
import { WorkoutsService } from './workouts.service';
import {
  WorkoutEngineService,
  SuggestedWorkout,
  CurrentCycleWorkouts,
} from './workout-engine.service';
import {
  CreateWorkoutDto,
  UpdateWorkoutDto,
  WorkoutResponseDto,
  WorkoutListItemDto,
  LastPerformanceDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientToday } from '../common/decorators/client-today.decorator';
import { Today } from '../common/utils/today.util';
import { ClientLocale } from '../common/decorators/client-locale.decorator';
import { ApiLocale } from '../common/utils/locale.util';

// Logging is now fully client-side (§3.3): the per-set lifecycle endpoints
// (start/logSet/updateSet/deleteSet/addExercise/removeExercise/reorder/replaceExercise/
// complete/discard/start-from-template) are gone. The client builds the whole workout
// locally and saves it once via create/update below.
@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(
    private readonly workoutsService: WorkoutsService,
    private readonly workoutEngineService: WorkoutEngineService,
  ) {}

  @Get('suggested')
  async getSuggestedWorkout(
    @CurrentUser() user: { id: string },
    @ClientToday() today: Today,
    @ClientLocale() locale: ApiLocale,
  ): Promise<SuggestedWorkout | null> {
    return this.workoutEngineService.getSuggestedWorkout(user.id, today, locale);
  }

  @Get('cycle/workouts')
  async getCurrentCycleWorkouts(
    @CurrentUser() user: { id: string },
    @ClientToday() today: Today,
  ): Promise<CurrentCycleWorkouts | null> {
    return this.workoutEngineService.getCurrentCycleWorkouts(user.id, today);
  }

  @Get('exercise-last-performance')
  async getExerciseLastPerformance(
    @CurrentUser() user: { id: string },
    @Query('exerciseId') exerciseId: string,
    @Query('gymId') gymId?: string,
    @Query('excludeWorkoutId') excludeWorkoutId?: string,
  ): Promise<LastPerformanceDto | null> {
    if (!exerciseId) {
      throw new AppBadRequestException('exerciseId is required', 'EXERCISE_ID_REQUIRED');
    }
    return this.workoutsService.findExerciseLastPerformance(
      user.id,
      exerciseId,
      gymId || undefined,
      excludeWorkoutId || undefined,
    );
  }

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('cycleId') cycleId?: string,
  ): Promise<WorkoutListItemDto[]> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.workoutsService.findAll(user.id, start, end, cycleId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.findById(id, user.id, locale);
  }

  @Post()
  async create(
    @Body() createDto: CreateWorkoutDto,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.create(createDto, user.id, locale);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWorkoutDto,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.update(id, updateDto, user.id, locale);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }): Promise<void> {
    return this.workoutsService.delete(id, user.id);
  }
}
