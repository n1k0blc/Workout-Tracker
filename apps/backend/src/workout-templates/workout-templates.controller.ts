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
import { WorkoutTemplateDto, CreateWorkoutTemplateDto, UpdateWorkoutTemplateDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientLocale } from '../common/decorators/client-locale.decorator';
import { ApiLocale } from '../common/utils/locale.util';

// createFromBlueprint/createFromWorkout are gone (§3.4): "save as template" and
// "overwrite template" are now side-effect flags on the workouts save endpoint,
// applied via the shared workout-tree copy primitive in the same transaction.
@Controller('workout-templates')
@UseGuards(JwtAuthGuard)
export class WorkoutTemplatesController {
  constructor(private readonly workoutTemplatesService: WorkoutTemplatesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<WorkoutTemplateDto[]> {
    return this.workoutTemplatesService.findAll(user.id, locale);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @ClientLocale() locale: ApiLocale,
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.findOne(id, user.id, locale);
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() createDto: CreateWorkoutTemplateDto,
    @ClientLocale() locale: ApiLocale,
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.create(user.id, createDto, locale);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateDto: UpdateWorkoutTemplateDto,
    @ClientLocale() locale: ApiLocale,
  ): Promise<WorkoutTemplateDto> {
    return this.workoutTemplatesService.update(id, user.id, updateDto, locale);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }): Promise<void> {
    return this.workoutTemplatesService.delete(id, user.id);
  }
}
