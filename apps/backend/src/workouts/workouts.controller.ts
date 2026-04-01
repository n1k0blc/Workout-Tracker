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
import { WorkoutsService } from './workouts.service';
import { WorkoutEngineService, SuggestedWorkout, CurrentCycleWorkouts } from './workout-engine.service';
import {
  StartWorkoutDto,
  LogSetDto,
  UpdateSetDto,
  AddExerciseToWorkoutDto,
  CompleteWorkoutDto,
  UpdateCompletedWorkoutDto,
  WorkoutResponseDto,
  WorkoutListItemDto,
  WorkoutStatus,
  ReplaceExerciseDto,
} from './dto';
import { ReorderExercisesDto } from './dto/reorder-exercises.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
  ): Promise<SuggestedWorkout | null> {
    return this.workoutEngineService.getSuggestedWorkout(user.id);
  }

  @Get('cycle/workouts')
  async getCurrentCycleWorkouts(
    @CurrentUser() user: { id: string },
  ): Promise<CurrentCycleWorkouts | null> {
    return this.workoutEngineService.getCurrentCycleWorkouts(user.id);
  }

  @Get('active')
  async getActiveWorkout(
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto | null> {
    return this.workoutsService.findActive(user.id);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query('status') status?: WorkoutStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<WorkoutListItemDto[]> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.workoutsService.findAll(user.id, status, start, end);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.findById(id, user.id);
  }

  @Post('start')
  async start(
    @Body() startWorkoutDto: StartWorkoutDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.start(startWorkoutDto, user.id);
  }

  @Post(':id/exercises')
  async addExercise(
    @Param('id') id: string,
    @Body() addExerciseDto: AddExerciseToWorkoutDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.addExercise(id, addExerciseDto, user.id);
  }

  @Delete(':workoutId/exercises/:exerciseLogId')
  @HttpCode(HttpStatus.OK)
  async removeExercise(
    @Param('workoutId') workoutId: string,
    @Param('exerciseLogId') exerciseLogId: string,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.removeExercise(workoutId, exerciseLogId, user.id);
  }

  @Patch(':workoutId/exercises/reorder')
  async reorderExercises(
    @Param('workoutId') workoutId: string,
    @Body() reorderDto: ReorderExercisesDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.reorderExercises(workoutId, reorderDto.exerciseIds, user.id);
  }

  @Post(':workoutId/exercises/:exerciseLogId/sets')
  async logSet(
    @Param('workoutId') workoutId: string,
    @Param('exerciseLogId') exerciseLogId: string,
    @Body() logSetDto: LogSetDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.logSet(workoutId, exerciseLogId, logSetDto, user.id);
  }

  @Delete(':workoutId/sets/:setLogId')
  @HttpCode(HttpStatus.OK)
  async deleteSet(
    @Param('workoutId') workoutId: string,
    @Param('setLogId') setLogId: string,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.deleteSet(workoutId, setLogId, user.id);
  }

  @Patch(':workoutId/sets/:setLogId')
  async updateSet(
    @Param('workoutId') workoutId: string,
    @Param('setLogId') setLogId: string,
    @Body() updateSetDto: UpdateSetDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.updateSet(workoutId, setLogId, updateSetDto, user.id);
  }

  @Patch(':workoutId/exercises/:exerciseLogId/replace')
  async replaceExercise(
    @Param('workoutId') workoutId: string,
    @Param('exerciseLogId') exerciseLogId: string,
    @Body() replaceDto: ReplaceExerciseDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.replaceExercise(
      workoutId,
      exerciseLogId,
      replaceDto.newExerciseId,
      user.id,
    );
  }

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @Body() completeWorkoutDto: CompleteWorkoutDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.complete(id, completeWorkoutDto, user.id);
  }

  @Patch(':id')
  async updateCompletedWorkout(
    @Param('id') id: string,
    @Body() updateDto: UpdateCompletedWorkoutDto,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.updateCompletedWorkout(id, updateDto, user.id);
  }

  @Post(':id/discard')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(@Param('id') id: string, @CurrentUser() user: { id: string }): Promise<void> {
    return this.workoutsService.discard(id, user.id);
  }
}
