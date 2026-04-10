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
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, FilterExerciseDto, ExerciseDto, UpdateExerciseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query() filterDto: FilterExerciseDto,
    @CurrentUser() user: { id: string },
  ): Promise<ExerciseDto[]> {
    return this.exercisesService.findAll(filterDto, user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ExerciseDto> {
    return this.exercisesService.findById(id, user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createExerciseDto: CreateExerciseDto,
    @CurrentUser() user: { id: string },
  ): Promise<ExerciseDto> {
    return this.exercisesService.create(createExerciseDto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateExerciseDto: UpdateExerciseDto,
    @CurrentUser() user: { id: string },
  ): Promise<ExerciseDto> {
    return this.exercisesService.update(id, user.id, updateExerciseDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }): Promise<void> {
    return this.exercisesService.delete(id, user.id);
  }
}
