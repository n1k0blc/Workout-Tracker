import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  WorkoutTreeService,
  ExerciseInput,
  mapExercisesToResponse,
  toExerciseInputs,
  WORKOUT_EXERCISE_TREE_INCLUDE,
} from '../workout-tree/workout-tree.service';
import { setWorkingVolume } from '../common/utils/volume.util';
import { ExercisesService } from '../exercises/exercises.service';
import { CreateWorkoutDto, SaveAsTemplateMode } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutResponseDto, WorkoutListItemDto } from './dto/workout-response.dto';

const WORKOUT_FULL_INCLUDE = {
  cycle: { select: { name: true } },
  workoutDay: { select: { name: true, weekday: true } },
  homeGym: { select: { id: true, name: true } },
  originTemplate: { select: { id: true, name: true } },
  ...WORKOUT_EXERCISE_TREE_INCLUDE,
};

interface SaveContext {
  workoutDay: { id: string; cycleId: string; plannedHomeGymId: string | null } | null;
  overwriteTemplate: { id: string } | null;
}

@Injectable()
export class WorkoutsService {
  constructor(
    private prisma: PrismaService,
    private workoutTreeService: WorkoutTreeService,
    private exercisesService: ExercisesService,
  ) {}

  async findAll(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    cycleId?: string,
  ): Promise<WorkoutListItemDto[]> {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        kind: 'WORKOUT',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        ...(cycleId ? { cycleId } : {}),
      },
      include: {
        cycle: { select: { name: true } },
        workoutDay: { select: { name: true, weekday: true } },
        homeGym: { select: { id: true, name: true, createdAt: true } },
        originTemplate: { select: { id: true, name: true } },
        exercises: {
          include: {
            exercise: { select: { isDoubleWeight: true } },
            sets: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return workouts.map((workout) => {
      let totalVolume = 0;
      for (const exercise of workout.exercises) {
        for (const set of exercise.sets) {
          totalVolume += setWorkingVolume(set, exercise.exercise);
        }
      }

      return {
        id: workout.id,
        date: workout.date!,
        isFreeWorkout: workout.isFreeWorkout!,
        totalDuration: workout.totalDuration ?? undefined,
        totalVolume,
        homeGymId: workout.homeGymId,
        homeGym: workout.homeGym
          ? { id: workout.homeGym.id, name: workout.homeGym.name }
          : undefined,
        cycleName: workout.cycle?.name,
        workoutDayName: workout.workoutDay?.name,
        workoutDayWeekday: workout.workoutDay?.weekday,
        originTemplateId: workout.originTemplateId ?? undefined,
        originTemplateName: workout.originTemplate?.name ?? undefined,
        exerciseCount: workout.exercises.length,
        createdAt: workout.createdAt,
      };
    });
  }

  async findById(id: string, userId: string): Promise<WorkoutResponseDto> {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: WORKOUT_FULL_INCLUDE,
    });

    if (!workout || workout.kind !== 'WORKOUT' || workout.userId !== userId) {
      throw new NotFoundException('Workout not found');
    }

    return this.mapWorkoutToResponse(workout);
  }

  async create(dto: CreateWorkoutDto, userId: string): Promise<WorkoutResponseDto> {
    if (!dto.isFreeWorkout && (!dto.cycleId || !dto.workoutDayId)) {
      throw new BadRequestException('cycleId and workoutDayId are required for non-free workouts');
    }

    const ctx = await this.resolveSaveContext(dto, userId);
    const exerciseInputs = toExerciseInputs(dto.exercises);

    const workoutId = await this.prisma.$transaction(async (tx) => {
      const workout = await tx.workout.create({
        data: {
          kind: 'WORKOUT',
          userId,
          date: new Date(dto.date),
          localDate: dto.localDate,
          totalDuration: dto.totalDuration,
          isFreeWorkout: dto.isFreeWorkout ?? false,
          homeGymId: dto.homeGymId || null,
          cycleId: dto.cycleId || null,
          workoutDayId: dto.workoutDayId || null,
          originTemplateId: dto.originTemplateId || null,
        },
      });

      await this.workoutTreeService.replaceTree(tx, workout.id, exerciseInputs);
      await this.applySideEffects(tx, exerciseInputs, dto, ctx, userId);

      return workout.id;
    });

    return this.findById(workoutId, userId);
  }

  async update(id: string, dto: UpdateWorkoutDto, userId: string): Promise<WorkoutResponseDto> {
    const existing = await this.prisma.workout.findUnique({ where: { id } });
    if (!existing || existing.kind !== 'WORKOUT' || existing.userId !== userId) {
      throw new NotFoundException('Workout not found');
    }

    const wantsSideEffect = dto.overwriteBlueprint || (dto.saveAsTemplateMode && dto.saveAsTemplateMode !== SaveAsTemplateMode.NONE);
    if (wantsSideEffect && !dto.exercises) {
      throw new BadRequestException('exercises must be provided when requesting a save side-effect');
    }

    const ctx = await this.resolveSaveContext(dto, userId, existing);
    const exerciseInputs = dto.exercises ? toExerciseInputs(dto.exercises) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.workout.update({
        where: { id },
        data: {
          ...(dto.date !== undefined && { date: new Date(dto.date) }),
          ...(dto.localDate !== undefined && { localDate: dto.localDate }),
          ...(dto.totalDuration !== undefined && { totalDuration: dto.totalDuration }),
          ...(dto.isFreeWorkout !== undefined && { isFreeWorkout: dto.isFreeWorkout }),
          ...(dto.homeGymId !== undefined && { homeGymId: dto.homeGymId || null }),
          ...(dto.cycleId !== undefined && { cycleId: dto.cycleId || null }),
          ...(dto.workoutDayId !== undefined && { workoutDayId: dto.workoutDayId || null }),
          ...(dto.originTemplateId !== undefined && { originTemplateId: dto.originTemplateId || null }),
        },
      });

      if (exerciseInputs) {
        await this.workoutTreeService.replaceTree(tx, id, exerciseInputs);
        await this.applySideEffects(tx, exerciseInputs, dto, ctx, userId);
      }
    });

    return this.findById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const workout = await this.prisma.workout.findUnique({ where: { id } });
    if (!workout || workout.kind !== 'WORKOUT' || workout.userId !== userId) {
      throw new NotFoundException('Workout not found');
    }

    await this.prisma.workout.delete({ where: { id } });
  }

  /**
   * Validates the §3.4 availability matrix and resolves the DB rows the side effects need.
   * BOLA: homeGymId/workoutDayId/originTemplateId/overwriteTemplateId are all re-verified
   * against `userId` here rather than trusted from the client.
   */
  private async resolveSaveContext(
    dto: CreateWorkoutDto | UpdateWorkoutDto,
    userId: string,
    existing?: { originTemplateId: string | null; localDate?: string },
  ): Promise<SaveContext> {
    if (dto.exercises) {
      await this.exercisesService.validateAccessible(dto.exercises.map((e) => e.exerciseId), userId);
    }

    if (dto.homeGymId) {
      const gym = await this.prisma.homeGym.findUnique({ where: { id: dto.homeGymId } });
      if (!gym || gym.userId !== userId) {
        throw new NotFoundException('Home gym not found');
      }
    }

    let workoutDay: SaveContext['workoutDay'] = null;
    if (dto.workoutDayId) {
      const day = await this.prisma.workoutDay.findUnique({
        where: { id: dto.workoutDayId },
        include: { cycle: { select: { userId: true, startDate: true } } },
      });
      if (!day || day.cycle.userId !== userId) {
        throw new NotFoundException('Workout day not found');
      }
      if (dto.cycleId && day.cycleId !== dto.cycleId) {
        throw new BadRequestException('workoutDayId does not belong to cycleId');
      }

      // A cycle built ahead of its start date (planned Thursday for next Monday) has nothing
      // to start yet -- no workout of any kind, logged-today or backfilled, can predate it.
      const localDate = dto.localDate ?? existing?.localDate;
      const cycleStartLocalDate = day.cycle.startDate.toISOString().slice(0, 10);
      if (localDate && localDate < cycleStartLocalDate) {
        throw new BadRequestException('Dieser Zyklus hat noch nicht begonnen.');
      }

      workoutDay = { id: day.id, cycleId: day.cycleId, plannedHomeGymId: day.plannedHomeGymId };
    }

    if (dto.originTemplateId) {
      const template = await this.prisma.workout.findUnique({ where: { id: dto.originTemplateId } });
      if (!template || template.kind !== 'TEMPLATE' || (template.isCustom && template.userId !== userId)) {
        throw new NotFoundException('Origin template not found');
      }
    }

    if (dto.overwriteBlueprint) {
      if (!workoutDay) {
        throw new BadRequestException('overwriteBlueprint requires a cycle workoutDayId');
      }
      if (!dto.homeGymId) {
        throw new BadRequestException('overwriteBlueprint requires a home gym');
      }
    }

    let overwriteTemplate: SaveContext['overwriteTemplate'] = null;
    if (dto.saveAsTemplateMode === SaveAsTemplateMode.OVERWRITE) {
      const originTemplateId = dto.originTemplateId ?? existing?.originTemplateId;
      if (!dto.overwriteTemplateId) {
        throw new BadRequestException('overwriteTemplateId is required');
      }
      if (dto.overwriteTemplateId !== originTemplateId) {
        throw new BadRequestException("overwriteTemplateId must match the workout's origin template");
      }
      const template = await this.prisma.workout.findUnique({ where: { id: dto.overwriteTemplateId } });
      if (!template || template.kind !== 'TEMPLATE' || !template.isCustom || template.userId !== userId) {
        throw new NotFoundException('Template not found');
      }
      overwriteTemplate = { id: template.id };
    }

    if (dto.saveAsTemplateMode === SaveAsTemplateMode.NEW) {
      if (!dto.saveAsTemplateName) {
        throw new BadRequestException('saveAsTemplateName is required');
      }
      const existingTemplate = await this.prisma.workout.findFirst({
        where: { kind: 'TEMPLATE', userId, name: dto.saveAsTemplateName },
      });
      if (existingTemplate) {
        throw new ConflictException('A template with this name already exists');
      }
    }

    return { workoutDay, overwriteTemplate };
  }

  private async applySideEffects(
    tx: Prisma.TransactionClient,
    exerciseInputs: ExerciseInput[],
    dto: CreateWorkoutDto | UpdateWorkoutDto,
    ctx: SaveContext,
    userId: string,
  ): Promise<void> {
    if (dto.overwriteBlueprint && ctx.workoutDay) {
      const blueprint = await tx.workout.findFirst({
        where: { workoutDayId: ctx.workoutDay.id, kind: 'BLUEPRINT' },
      });
      if (blueprint) {
        await this.workoutTreeService.replaceTree(tx, blueprint.id, exerciseInputs);
        await tx.workout.update({ where: { id: blueprint.id }, data: { updatedAt: new Date() } });
      }
    }

    if (dto.saveAsTemplateMode === SaveAsTemplateMode.NEW) {
      const template = await tx.workout.create({
        data: {
          kind: 'TEMPLATE',
          userId,
          name: dto.saveAsTemplateName,
          isCustom: true,
          homeGymId: dto.homeGymId || null,
        },
      });
      await this.workoutTreeService.replaceTree(tx, template.id, exerciseInputs);
    } else if (dto.saveAsTemplateMode === SaveAsTemplateMode.OVERWRITE && ctx.overwriteTemplate) {
      await this.workoutTreeService.replaceTree(tx, ctx.overwriteTemplate.id, exerciseInputs);
      await tx.workout.update({ where: { id: ctx.overwriteTemplate.id }, data: { updatedAt: new Date() } });
    }
  }

  private mapWorkoutToResponse(workout: any): WorkoutResponseDto {
    return {
      id: workout.id,
      date: workout.date,
      localDate: workout.localDate,
      isFreeWorkout: workout.isFreeWorkout,
      totalDuration: workout.totalDuration ?? undefined,
      homeGymId: workout.homeGymId ?? undefined,
      homeGym: workout.homeGym ? { id: workout.homeGym.id, name: workout.homeGym.name } : undefined,
      cycleId: workout.cycleId ?? undefined,
      cycleName: workout.cycle?.name,
      workoutDayId: workout.workoutDayId ?? undefined,
      workoutDayName: workout.workoutDay?.name,
      originTemplateId: workout.originTemplateId ?? undefined,
      originTemplateName: workout.originTemplate?.name,
      exercises: mapExercisesToResponse(workout.exercises),
      createdAt: workout.createdAt,
    };
  }
}
