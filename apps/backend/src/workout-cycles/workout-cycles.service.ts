import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WorkoutTreeService, mapExercisesToResponse, toExerciseInputs, WORKOUT_EXERCISE_TREE_INCLUDE } from '../workout-tree/workout-tree.service';
import { setWorkingVolume } from '../common/utils/volume.util';
import { calculateCycleWeek, getCurrentDate } from '../common/utils/date.util';
import { ExercisesService } from '../exercises/exercises.service';
import {
  CreateCycleDto,
  UpdateCycleDto,
  UpdateBlueprintDto,
  UpdateWorkoutDayDto,
  CycleResponseDto,
  CycleDetailsDto,
  WorkoutsByGymDto,
} from './dto';

const CYCLE_TREE_INCLUDE = {
  workoutDays: {
    include: {
      plannedHomeGym: {
        select: { id: true, name: true },
      },
      workouts: {
        where: { kind: 'BLUEPRINT' as const },
        include: WORKOUT_EXERCISE_TREE_INCLUDE,
      },
    },
    orderBy: { order: 'asc' as const },
  },
};

@Injectable()
export class WorkoutCyclesService {
  constructor(
    private prisma: PrismaService,
    private workoutTreeService: WorkoutTreeService,
    private exercisesService: ExercisesService,
  ) {}

  /**
   * Explicit, idempotent trigger (§3.6) -- runs hourly across all users, replacing the
   * old write-on-read side-effect that silently mutated cycle status inside GET handlers.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteExpiredCyclesSweep(): Promise<void> {
    const now = getCurrentDate();
    const activeCycles = await this.prisma.workoutCycle.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const cycle of activeCycles) {
      const endDate = new Date(cycle.startDate);
      endDate.setDate(endDate.getDate() + cycle.duration * 7);

      if (now > endDate) {
        await this.prisma.workoutCycle.update({
          where: { id: cycle.id },
          data: { status: 'COMPLETED', completedAt: endDate },
        });
      }
    }
  }

  async findAll(userId: string): Promise<CycleResponseDto[]> {
    const cycles = await this.prisma.workoutCycle.findMany({
      where: { userId },
      include: CYCLE_TREE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return cycles.map((cycle) => this.mapCycleToResponse(cycle));
  }

  async findById(id: string, userId: string): Promise<CycleResponseDto> {
    const cycle = await this.prisma.workoutCycle.findUnique({
      where: { id },
      include: CYCLE_TREE_INCLUDE,
    });

    if (!cycle || cycle.userId !== userId) {
      throw new NotFoundException('Workout cycle not found');
    }

    return this.mapCycleToResponse(cycle);
  }

  async create(createCycleDto: CreateCycleDto, userId: string): Promise<CycleResponseDto> {
    const existingActiveCycle = await this.prisma.workoutCycle.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (existingActiveCycle) {
      throw new BadRequestException('Es existiert bereits ein aktiver Zyklus. Bitte beende diesen zuerst.');
    }

    const { name, duration, startDate, workoutDays } = createCycleDto;

    const allExerciseIds = workoutDays.flatMap((day) => day.exercises.map((e) => e.exerciseId));
    await this.exercisesService.validateAccessible(allExerciseIds, userId);

    const cycleId = await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.workoutCycle.create({
        data: { name, duration, startDate: new Date(startDate), userId },
      });

      for (let i = 0; i < workoutDays.length; i++) {
        const day = workoutDays[i];
        const workoutDay = await tx.workoutDay.create({
          data: {
            cycleId: cycle.id,
            weekday: day.weekday,
            order: i,
            name: day.name,
            plannedHomeGymId: day.plannedHomeGymId || null,
          },
        });

        const blueprint = await tx.workout.create({
          data: { kind: 'BLUEPRINT', userId, workoutDayId: workoutDay.id },
        });

        await this.workoutTreeService.replaceTree(tx, blueprint.id, toExerciseInputs(day.exercises));
      }

      return cycle.id;
    });

    return this.findById(cycleId, userId);
  }

  async update(id: string, updateCycleDto: UpdateCycleDto, userId: string): Promise<CycleResponseDto> {
    await this.findById(id, userId);

    await this.prisma.workoutCycle.update({
      where: { id },
      data: {
        ...(updateCycleDto.name && { name: updateCycleDto.name }),
        ...(updateCycleDto.duration && { duration: updateCycleDto.duration }),
        ...(updateCycleDto.startDate && { startDate: new Date(updateCycleDto.startDate) }),
      },
    });

    return this.findById(id, userId);
  }

  async updateBlueprint(
    cycleId: string,
    workoutDayId: string,
    updateBlueprintDto: UpdateBlueprintDto,
    userId: string,
  ): Promise<CycleResponseDto> {
    await this.findById(cycleId, userId);
    await this.exercisesService.validateAccessible(
      updateBlueprintDto.exercises.map((e) => e.exerciseId),
      userId,
    );

    const workoutDay = await this.prisma.workoutDay.findUnique({
      where: { id: workoutDayId },
      include: { workouts: { where: { kind: 'BLUEPRINT' } } },
    });

    if (!workoutDay || workoutDay.cycleId !== cycleId) {
      throw new NotFoundException('Workout day not found');
    }

    const blueprint = workoutDay.workouts[0];
    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.workoutTreeService.replaceTree(tx, blueprint.id, toExerciseInputs(updateBlueprintDto.exercises));
      await tx.workout.update({ where: { id: blueprint.id }, data: { updatedAt: new Date() } });
    });

    return this.findById(cycleId, userId);
  }

  async updateWorkoutDay(
    cycleId: string,
    workoutDayId: string,
    updateWorkoutDayDto: UpdateWorkoutDayDto,
    userId: string,
  ): Promise<CycleResponseDto> {
    await this.findById(cycleId, userId);

    const workoutDay = await this.prisma.workoutDay.findUnique({
      where: { id: workoutDayId },
    });

    if (!workoutDay || workoutDay.cycleId !== cycleId) {
      throw new NotFoundException('Workout day not found');
    }

    await this.prisma.workoutDay.update({
      where: { id: workoutDayId },
      data: {
        name: updateWorkoutDayDto.name,
        weekday: updateWorkoutDayDto.weekday,
        ...(updateWorkoutDayDto.plannedHomeGymId !== undefined && {
          plannedHomeGymId: updateWorkoutDayDto.plannedHomeGymId,
        }),
      },
    });

    return this.findById(cycleId, userId);
  }

  async completeCycle(id: string, userId: string): Promise<CycleResponseDto> {
    const cycle = await this.findById(id, userId);

    if (cycle.status === 'COMPLETED') {
      throw new BadRequestException('Dieser Zyklus wurde bereits beendet.');
    }

    await this.prisma.workoutCycle.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: getCurrentDate() },
    });

    return this.findById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findById(id, userId);

    await this.prisma.workoutCycle.delete({
      where: { id },
    });
  }

  /**
   * Get detailed statistics and data for a cycle
   */
  async getCycleDetails(id: string, userId: string): Promise<CycleDetailsDto> {
    const cycle = await this.prisma.workoutCycle.findUnique({
      where: { id },
      include: { workoutDays: true },
    });

    if (!cycle || cycle.userId !== userId) {
      throw new NotFoundException('Zyklus nicht gefunden');
    }

    const endDate = new Date(cycle.startDate);
    endDate.setDate(endDate.getDate() + cycle.duration * 7);

    const workouts = await this.prisma.workout.findMany({
      where: { userId, cycleId: id, kind: 'WORKOUT' },
      include: {
        exercises: {
          include: {
            exercise: { select: { isUnilateral: true, isDoubleWeight: true } },
            sets: true,
          },
        },
        homeGym: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    let totalVolume = 0;
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        for (const set of exercise.sets) {
          totalVolume += setWorkingVolume(set, exercise.exercise);
        }
      }
    }

    const gymMap = new Map<string, { gymName: string; count: number; isHome: boolean }>();

    for (const workout of workouts) {
      if (workout.homeGym) {
        const key = workout.homeGym.id;
        if (gymMap.has(key)) {
          gymMap.get(key)!.count++;
        } else {
          gymMap.set(key, { gymName: workout.homeGym.name, count: 1, isHome: true });
        }
      } else {
        const key = 'other';
        if (gymMap.has(key)) {
          gymMap.get(key)!.count++;
        } else {
          gymMap.set(key, { gymName: 'Andere Gyms', count: 1, isHome: false });
        }
      }
    }

    const workoutsByGym: WorkoutsByGymDto[] = Array.from(gymMap.values());

    let currentWeek: number | undefined;
    let totalWeeks: number | undefined;
    let percentage: number | undefined;

    if (cycle.status === 'ACTIVE') {
      currentWeek = calculateCycleWeek(cycle.startDate, cycle.duration);
      totalWeeks = cycle.duration;
      percentage = Math.round(Math.min((currentWeek / totalWeeks) * 100, 100) * 100) / 100;
    }

    return {
      id: cycle.id,
      name: cycle.name,
      duration: cycle.duration,
      startDate: cycle.startDate,
      endDate,
      status: cycle.status,
      completedAt: cycle.completedAt ?? undefined,
      totalVolume: Math.round(totalVolume),
      workoutCount: workouts.length,
      workoutsByGym,
      currentWeek,
      totalWeeks,
      percentage,
    };
  }

  private mapCycleToResponse(cycle: any): CycleResponseDto {
    return {
      id: cycle.id,
      name: cycle.name,
      duration: cycle.duration,
      startDate: cycle.startDate,
      createdAt: cycle.createdAt,
      status: cycle.status,
      completedAt: cycle.completedAt ?? undefined,
      workoutDays: cycle.workoutDays.map((day: any) => {
        const blueprint = day.workouts?.[0];
        return {
          id: day.id,
          weekday: day.weekday,
          order: day.order,
          name: day.name,
          plannedHomeGymId: day.plannedHomeGymId ?? undefined,
          plannedHomeGym: day.plannedHomeGym
            ? { id: day.plannedHomeGym.id, name: day.plannedHomeGym.name }
            : undefined,
          blueprint: blueprint
            ? {
                id: blueprint.id,
                updatedAt: blueprint.updatedAt,
                exercises: mapExercisesToResponse(blueprint.exercises),
              }
            : undefined,
        };
      }),
    };
  }
}
