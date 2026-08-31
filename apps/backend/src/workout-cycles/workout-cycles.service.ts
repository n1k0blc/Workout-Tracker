import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkoutTreeService, mapExercisesToResponse, toExerciseInputs, WORKOUT_EXERCISE_TREE_INCLUDE } from '../workout-tree/workout-tree.service';
import { setWorkingVolume } from '../common/utils/volume.util';
import { calculateCycleWeek, getCurrentDate } from '../common/utils/date.util';
import { Today, localDateToInstant } from '../common/utils/today.util';
import { WEEKDAY_NAMES, getWeekdayDistanceFromCycleStart } from '../common/utils/weekday.util';
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

const WEEKDAY_UNIQUE_INDEX = 'WorkoutDay_cycleId_weekday_key';
const ORDER_UNIQUE_INDEX = 'WorkoutDay_cycleId_order_key';

/** Whether `error` is a P2002 raised by the given WorkoutDay unique index, and nothing else. */
function isUniqueIndexConflict(error: unknown, indexName: string, fields: string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  // `meta.target` is the index name on Postgres, but has been a field-name array on other
  // connectors and older client versions -- match either shape.
  const target = error.meta?.target;
  return Array.isArray(target) ? fields.every((field) => target.includes(field)) : target === indexName;
}

function isWeekdayConflict(error: unknown): boolean {
  return isUniqueIndexConflict(error, WEEKDAY_UNIQUE_INDEX, ['cycleId', 'weekday']);
}

/**
 * A P2002 on (cycleId, order) -- the sentinel-parking dance that moves and swaps use to dodge
 * a transient clash on their *own* rows can still collide with another request's write to a
 * *different* day in the same cycle. Rare, but real, so it gets the same 400 treatment as a
 * weekday clash rather than surfacing as a 500.
 */
function isOrderConflict(error: unknown): boolean {
  return isUniqueIndexConflict(error, ORDER_UNIQUE_INDEX, ['cycleId', 'order']);
}

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

    const weekdays = workoutDays.map((day) => day.weekday);
    const duplicateWeekday = weekdays.find((weekday, i) => weekdays.indexOf(weekday) !== i);
    if (duplicateWeekday !== undefined) {
      throw new BadRequestException(
        `Zwei Trainingstage liegen auf ${WEEKDAY_NAMES[duplicateWeekday]}. Pro Zyklus ist jeder Wochentag nur einmal erlaubt.`,
      );
    }

    const allExerciseIds = workoutDays.flatMap((day) => day.exercises.map((e) => e.exerciseId));
    const exercisesById = await this.exercisesService.validateAccessible(allExerciseIds, userId);

    const startWeekday = new Date(startDate).getUTCDay();

    const cycleId = await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.workoutCycle.create({
        data: { name, duration, startDate: new Date(startDate), userId },
      });

      for (const day of workoutDays) {
        const workoutDay = await tx.workoutDay.create({
          data: {
            cycleId: cycle.id,
            weekday: day.weekday,
            order: getWeekdayDistanceFromCycleStart(day.weekday, startWeekday),
            name: day.name,
            plannedHomeGymId: day.plannedHomeGymId || null,
          },
        });

        const blueprint = await tx.workout.create({
          data: { kind: 'BLUEPRINT', userId, workoutDayId: workoutDay.id },
        });

        await this.workoutTreeService.replaceTree(
          tx,
          blueprint.id,
          toExerciseInputs(day.exercises, exercisesById),
        );
      }

      return cycle.id;
    });

    return this.findById(cycleId, userId);
  }

  async update(id: string, updateCycleDto: UpdateCycleDto, userId: string): Promise<CycleResponseDto> {
    const cycle = await this.findById(id, userId);

    // The re-anchor below writes WorkoutDay rows, so this shares the move and swap paths'
    // conflict handling: a concurrent write winning either unique index has to answer 400,
    // not 500. It rewrites every day at once, so there is no single weekday to blame.
    await this.runWorkoutDayWrite(
      () =>
        this.prisma.$transaction(async (tx) => {
          await tx.workoutCycle.update({
            where: { id },
            data: {
              ...(updateCycleDto.name && { name: updateCycleDto.name }),
              ...(updateCycleDto.duration && { duration: updateCycleDto.duration }),
              ...(updateCycleDto.startDate && { startDate: new Date(updateCycleDto.startDate) }),
            },
          });

          // Moving the cycle's start day re-anchors its week, so every day's `order` -- kept
          // in sync with its distance from the start weekday (#74) -- needs recomputing too.
          // The new values are a permutation of the old ones, so a single pass risks a
          // transient clash with the (cycleId, order) unique index; parking everything at
          // negative, never-colliding placeholders first avoids that.
          const startWeekday = updateCycleDto.startDate
            ? new Date(updateCycleDto.startDate).getUTCDay()
            : undefined;

          if (startWeekday !== undefined && startWeekday !== cycle.startDate.getUTCDay()) {
            for (const [index, day] of cycle.workoutDays.entries()) {
              await tx.workoutDay.update({ where: { id: day.id }, data: { order: -1 - index } });
            }
            for (const day of cycle.workoutDays) {
              await tx.workoutDay.update({
                where: { id: day.id },
                data: { order: getWeekdayDistanceFromCycleStart(day.weekday, startWeekday) },
              });
            }
          }
        }),
      null,
    );

    return this.findById(id, userId);
  }

  async updateBlueprint(
    cycleId: string,
    workoutDayId: string,
    updateBlueprintDto: UpdateBlueprintDto,
    userId: string,
  ): Promise<CycleResponseDto> {
    await this.findById(cycleId, userId);
    const exercisesById = await this.exercisesService.validateAccessible(
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
      await this.workoutTreeService.replaceTree(
        tx,
        blueprint.id,
        toExerciseInputs(updateBlueprintDto.exercises, exercisesById),
      );
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
    const cycle = await this.findById(cycleId, userId);

    const workoutDay = await this.prisma.workoutDay.findUnique({
      where: { id: workoutDayId },
    });

    if (!workoutDay || workoutDay.cycleId !== cycleId) {
      throw new NotFoundException('Workout day not found');
    }

    // The weekday decides which workout is recommended, so two days in one cycle sharing a
    // weekday has no correct answer. The unique index on (cycleId, weekday) would reject this
    // anyway -- catching it here turns a 500 from a driver-level constraint error into a 400
    // the editor can show.
    const conflict = cycle.workoutDays.find(
      (day) => day.weekday === updateWorkoutDayDto.weekday && day.id !== workoutDayId,
    );

    const startWeekday = cycle.startDate.getUTCDay();
    const newOrder = getWeekdayDistanceFromCycleStart(updateWorkoutDayDto.weekday, startWeekday);

    if (conflict) {
      // A plain move can't land on a taken weekday -- the editor has to ask the user to swap
      // with the specific day that holds it first, and confirm that by passing its id back.
      if (updateWorkoutDayDto.swapWithWorkoutDayId !== conflict.id) {
        throw new BadRequestException(
          `${WEEKDAY_NAMES[updateWorkoutDayDto.weekday]} ist in diesem Zyklus bereits durch "${conflict.name}" belegt.`,
        );
      }

      // Exchange weekdays (and their derived `order`) atomically -- names, plans and planned
      // gyms stay with their own day. Both rows would collide on (cycleId, weekday) and
      // (cycleId, order) mid-swap, since each is about to take the slot the other currently
      // holds, so this day is parked at a sentinel first to free its slot for the conflict day.
      const conflictOrder = getWeekdayDistanceFromCycleStart(workoutDay.weekday, startWeekday);

      await this.runWorkoutDayWrite(
        () =>
          this.prisma.$transaction(async (tx) => {
            await tx.workoutDay.update({ where: { id: workoutDayId }, data: { weekday: -1, order: -1 } });
            await tx.workoutDay.update({
              where: { id: conflict.id },
              data: { weekday: workoutDay.weekday, order: conflictOrder },
            });
            await tx.workoutDay.update({
              where: { id: workoutDayId },
              data: {
                name: updateWorkoutDayDto.name,
                weekday: updateWorkoutDayDto.weekday,
                order: newOrder,
                ...(updateWorkoutDayDto.plannedHomeGymId !== undefined && {
                  plannedHomeGymId: updateWorkoutDayDto.plannedHomeGymId,
                }),
              },
            });
          }),
        updateWorkoutDayDto.weekday,
      );

      return this.findById(cycleId, userId);
    }

    await this.runWorkoutDayWrite(
      () =>
        this.prisma.workoutDay.update({
          where: { id: workoutDayId },
          data: {
            name: updateWorkoutDayDto.name,
            weekday: updateWorkoutDayDto.weekday,
            order: newOrder,
            ...(updateWorkoutDayDto.plannedHomeGymId !== undefined && {
              plannedHomeGymId: updateWorkoutDayDto.plannedHomeGymId,
            }),
          },
        }),
      updateWorkoutDayDto.weekday,
    );

    return this.findById(cycleId, userId);
  }

  /**
   * Runs a WorkoutDay write and maps a P2002 on either of its unique indexes to a 400 --
   * the plain move, the swap and the start-date re-anchor all read the cycle before writing,
   * but read-then-write leaves a window for a concurrent request to win either index first.
   * Rare, but the endpoint must answer 400 rather than let a driver error surface as a 500.
   *
   * `weekday` is the day the caller was aiming for, and lets a lost weekday race name it in
   * the message. The re-anchor rewrites every day at once, so it has no single day to blame
   * and passes `null` -- for it, either index losing means only "someone raced you".
   */
  private async runWorkoutDayWrite<T>(write: () => Promise<T>, weekday: number | null): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (weekday !== null && isWeekdayConflict(error)) {
        throw new BadRequestException(`${WEEKDAY_NAMES[weekday]} ist in diesem Zyklus bereits belegt.`);
      }
      if (isWeekdayConflict(error) || isOrderConflict(error)) {
        throw new BadRequestException(
          'Eine andere Änderung an diesem Zyklus ist dazwischengekommen. Bitte versuche es erneut.',
        );
      }
      throw error;
    }
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
   * Get detailed statistics and data for a cycle.
   *
   * Takes the client's `Today` for the same reason the dashboard's cycle-progress card does:
   * this view reports the same week number, so a server-clock "today" here would disagree with
   * the card near local midnight.
   */
  async getCycleDetails(id: string, userId: string, today: Today): Promise<CycleDetailsDto> {
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
            exercise: { select: { isDoubleWeight: true } },
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
      currentWeek = calculateCycleWeek(
        cycle.startDate,
        cycle.duration,
        localDateToInstant(today.localDate),
      );
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
