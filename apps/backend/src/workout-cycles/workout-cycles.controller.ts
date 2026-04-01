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
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('cycles')
@UseGuards(JwtAuthGuard)
export class WorkoutCyclesController {
  constructor(private readonly workoutCyclesService: WorkoutCyclesService) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }): Promise<CycleResponseDto[]> {
    return this.workoutCyclesService.findAll(user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.findById(id, user.id);
  }

  @Post()
  async create(
    @Body() createCycleDto: CreateCycleDto,
    @CurrentUser() user: { id: string },
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.create(createCycleDto, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCycleDto: UpdateCycleDto,
    @CurrentUser() user: { id: string },
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.update(id, updateCycleDto, user.id);
  }

  @Post(':id/complete')
  async completeCycle(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.completeCycle(id, user.id);
  }

  @Patch(':cycleId/workout-days/:workoutDayId/blueprint')
  async updateBlueprint(
    @Param('cycleId') cycleId: string,
    @Param('workoutDayId') workoutDayId: string,
    @Body() updateBlueprintDto: UpdateBlueprintDto,
    @CurrentUser() user: { id: string },
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.updateBlueprint(
      cycleId,
      workoutDayId,
      updateBlueprintDto,
      user.id,
    );
  }

  @Patch(':cycleId/workout-days/:workoutDayId')
  async updateWorkoutDay(
    @Param('cycleId') cycleId: string,
    @Param('workoutDayId') workoutDayId: string,
    @Body() updateWorkoutDayDto: UpdateWorkoutDayDto,
    @CurrentUser() user: { id: string },
  ): Promise<CycleResponseDto> {
    return this.workoutCyclesService.updateWorkoutDay(
      cycleId,
      workoutDayId,
      updateWorkoutDayDto,
      user.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }): Promise<void> {
    return this.workoutCyclesService.delete(id, user.id);
  }
}
