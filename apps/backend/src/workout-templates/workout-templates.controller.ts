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
import { WorkoutTemplatesService } from './workout-templates.service';
import {
  WorkoutTemplateDto,
  CreateWorkoutTemplateDto,
  UpdateWorkoutTemplateDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('workout-templates')
@UseGuards(JwtAuthGuard)
export class WorkoutTemplatesController {
  constructor(private readonly workoutTemplatesService: WorkoutTemplatesService) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }): Promise<WorkoutTemplateDto[]> {
    return this.workoutTemplatesService.findAll(user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.findOne(id, user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() createDto: CreateWorkoutTemplateDto,
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.create(user.id, createDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateDto: UpdateWorkoutTemplateDto,
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.update(id, user.id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.workoutTemplatesService.delete(id, user.id);
  }

  @Post('from-blueprint/:blueprintId')
  async createFromBlueprint(
    @Param('blueprintId') blueprintId: string,
    @CurrentUser() user: { id: string },
    @Body('name') name: string,
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.createFromBlueprint(blueprintId, user.id, name);
  }

  @Post('from-workout/:workoutId')
  async createFromWorkout(
    @Param('workoutId') workoutId: string,
    @CurrentUser() user: { id: string },
    @Body('name') name: string,
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.createFromWorkout(workoutId, user.id, name);
  }
}
