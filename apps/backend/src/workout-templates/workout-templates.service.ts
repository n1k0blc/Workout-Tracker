import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WorkoutTreeService,
  mapExercisesToResponse,
  toExerciseInputs,
  WORKOUT_EXERCISE_TREE_INCLUDE,
} from '../workout-tree/workout-tree.service';
import { WorkoutTemplateDto, CreateWorkoutTemplateDto, UpdateWorkoutTemplateDto } from './dto';
import { ExercisesService } from '../exercises/exercises.service';

const TEMPLATE_INCLUDE = {
  ...WORKOUT_EXERCISE_TREE_INCLUDE,
  homeGym: { select: { id: true, name: true } },
};

@Injectable()
export class WorkoutTemplatesService {
  constructor(
    private prisma: PrismaService,
    private workoutTreeService: WorkoutTreeService,
    private exercisesService: ExercisesService,
  ) {}

  async findAll(userId: string): Promise<WorkoutTemplateDto[]> {
    const templates = await this.prisma.workout.findMany({
      where: {
        kind: 'TEMPLATE',
        OR: [{ isCustom: false }, { userId }],
      },
      include: TEMPLATE_INCLUDE,
      orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
    });

    return templates.map((template) => this.mapToDto(template));
  }

  async findOne(id: string, userId: string): Promise<WorkoutTemplateDto> {
    const template = await this.prisma.workout.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });

    if (!template || template.kind !== 'TEMPLATE') {
      throw new NotFoundException('Workout template not found');
    }

    if (template.isCustom && template.userId !== userId) {
      throw new NotFoundException('Workout template not found');
    }

    return this.mapToDto(template);
  }

  async create(userId: string, createDto: CreateWorkoutTemplateDto): Promise<WorkoutTemplateDto> {
    const existing = await this.prisma.workout.findFirst({
      where: { kind: 'TEMPLATE', userId, name: createDto.name },
    });

    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }

    await this.exercisesService.validateAccessible(
      createDto.exercises.map((e) => e.exerciseId),
      userId,
    );

    const templateId = await this.prisma.$transaction(async (tx) => {
      const template = await tx.workout.create({
        data: {
          kind: 'TEMPLATE',
          name: createDto.name,
          isCustom: true,
          userId,
          homeGymId: createDto.recommendedGymId,
        },
      });

      await this.workoutTreeService.replaceTree(tx, template.id, toExerciseInputs(createDto.exercises));
      return template.id;
    });

    return this.findOne(templateId, userId);
  }

  async update(id: string, userId: string, updateDto: UpdateWorkoutTemplateDto): Promise<WorkoutTemplateDto> {
    const template = await this.prisma.workout.findUnique({ where: { id } });

    if (!template || template.kind !== 'TEMPLATE') {
      throw new NotFoundException('Workout template not found');
    }

    if (template.isCustom && template.userId !== userId) {
      throw new NotFoundException('Workout template not found');
    }

    if (!template.isCustom) {
      throw new ConflictException('System templates cannot be edited');
    }

    if (updateDto.name && updateDto.name !== template.name) {
      const existing = await this.prisma.workout.findFirst({
        where: { kind: 'TEMPLATE', userId, name: updateDto.name, id: { not: id } },
      });

      if (existing) {
        throw new ConflictException('A template with this name already exists');
      }
    }

    if (updateDto.exercises) {
      await this.exercisesService.validateAccessible(
        updateDto.exercises.map((e) => e.exerciseId),
        userId,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workout.update({
        where: { id },
        data: {
          name: updateDto.name,
          ...(updateDto.recommendedGymId !== undefined && { homeGymId: updateDto.recommendedGymId }),
        },
      });

      if (updateDto.exercises) {
        await this.workoutTreeService.replaceTree(tx, id, toExerciseInputs(updateDto.exercises));
      }
    });

    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const template = await this.prisma.workout.findUnique({ where: { id } });

    if (!template || template.kind !== 'TEMPLATE') {
      throw new NotFoundException('Workout template not found');
    }

    if (template.isCustom && template.userId !== userId) {
      throw new NotFoundException('Workout template not found');
    }

    if (!template.isCustom) {
      throw new ConflictException('System templates cannot be deleted');
    }

    await this.prisma.workout.delete({ where: { id } });
  }

  private mapToDto(template: any): WorkoutTemplateDto {
    const exercises = mapExercisesToResponse(template.exercises);

    return {
      id: template.id,
      name: template.name,
      isCustom: template.isCustom,
      userId: template.userId ?? undefined,
      recommendedGymId: template.homeGymId ?? undefined,
      recommendedGymName: template.homeGym?.name,
      createdAt: template.createdAt,
      exercises,
      totalExercises: exercises.length,
      totalSets: exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    };
  }
}
