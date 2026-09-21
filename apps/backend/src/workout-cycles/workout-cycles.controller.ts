import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkoutCyclesService } from './workout-cycles.service';
import {
  CreateCycleDto,
  UpdateCycleDto,
  UpdateBlueprintDto,
  UpdateWorkoutDayDto,
  CycleResponseDto,
  CycleDetailsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientToday } from '../common/decorators/client-today.decorator';
import { Today } from '../common/utils/today.util';
import { ClientLocale } from '../common/decorators/client-locale.decorator';
import { ApiLocale } from '../common/utils/locale.util';

@Controller('cycles')
@UseGuards(JwtAuthGuard)
export class WorkoutCyclesController {
  constructor(private readonly workoutCyclesService: WorkoutCyclesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<CycleResponseDto[]> {
    return this.workoutCyclesService.findAll(user.id, locale);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.findById(id, user.id, locale);
  }

  @Get(':id/details')
  async getCycleDetails(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @ClientToday() today: Today,
  ): Promise<CycleDetailsDto> {
    return this.workoutCyclesService.getCycleDetails(id, user.id, today);
  }

  @Post()
  async create(
    @Body() createCycleDto: CreateCycleDto,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.create(createCycleDto, user.id, locale);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCycleDto: UpdateCycleDto,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.update(id, updateCycleDto, user.id, locale);
  }

  @Post(':id/complete')
  async completeCycle(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.completeCycle(id, user.id, locale);
  }

  @Patch(':cycleId/workout-days/:workoutDayId/blueprint')
  async updateBlueprint(
    @Param('cycleId') cycleId: string,
    @Param('workoutDayId') workoutDayId: string,
    @Body() updateBlueprintDto: UpdateBlueprintDto,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.updateBlueprint(
      cycleId,
      workoutDayId,
      updateBlueprintDto,
      user.id,
      locale,
    );
  }

  @Patch(':cycleId/workout-days/:workoutDayId')
  async updateWorkoutDay(
    @Param('cycleId') cycleId: string,
    @Param('workoutDayId') workoutDayId: string,
    @Body() updateWorkoutDayDto: UpdateWorkoutDayDto,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.updateWorkoutDay(
      cycleId,
      workoutDayId,
      updateWorkoutDayDto,
      user.id,
      locale,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }): Promise<void> {
    return this.workoutCyclesService.delete(id, user.id);
  }
}
