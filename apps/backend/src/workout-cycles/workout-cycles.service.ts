import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCycleDto,
  UpdateCycleDto,
  UpdateBlueprintDto,
  UpdateWorkoutDayDto,
  CycleResponseDto,
} from './dto';

@Injectable()
export class WorkoutCyclesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Prüft und beendet automatisch Zyklen, deren Dauer abgelaufen ist
   */
  private async autoCompleteExpiredCycles(userId: string): Promise<void> {
    const now = new Date();
    
    // Finde alle aktiven Zyklen des Users
    const activeCycles = await this.prisma.workoutCycle.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    // Prüfe jeden Zyklus auf Ablauf
    for (const cycle of activeCycles) {
      const endDate = new Date(cycle.startDate);
      endDate.setDate(endDate.getDate() + cycle.duration * 7);

      // Wenn Enddatum überschritten, beende Zyklus
      if (now > endDate) {
        await this.prisma.workoutCycle.update({
          where: { id: cycle.id },
          data: {
            status: 'COMPLETED',
            completedAt: endDate, // Verwende Enddatum, nicht aktuelles Datum
          },
        });
      }
    }
  }

  async findAll(userId: string): Promise<CycleResponseDto[]> {
    // Auto-complete abgelaufene Zyklen vor dem Abrufen
    await this.autoCompleteExpiredCycles(userId);

    const cycles = await this.prisma.workoutCycle.findMany({
      where: { userId },
      include: {
        workoutDays: {
          include: {
            plannedHomeGym: {
              select: { id: true, name: true },
            },
            blueprint: {
              include: {
                exercises: {
                  include: {
                    exercise: {
                      select: {
                        name: true,
                        isUnilateral: true,
                        isDoubleWeight: true,
                      },
                    },
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { weekday: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cycles.map((cycle) => this.mapCycleToResponse(cycle));
  }

  async findById(id: string, userId: string): Promise<CycleResponseDto> {
    // Auto-complete abgelaufene Zyklen vor dem Abrufen
    await this.autoCompleteExpiredCycles(userId);

    const cycle = await this.prisma.workoutCycle.findUnique({
      where: { id },
      include: {
        workoutDays: {
          include: {
            plannedHomeGym: {
              select: { id: true, name: true },
            },
            blueprint: {
              include: {
                exercises: {
                  include: {
                    exercise: {
                      select: {
                        name: true,
                        isUnilateral: true,
                        isDoubleWeight: true,
                      },
                    },
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { weekday: 'asc' },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException('Workout cycle not found');
    }

    if (cycle.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapCycleToResponse(cycle);
  }

  async create(createCycleDto: CreateCycleDto, userId: string): Promise<CycleResponseDto> {
    // Check if an active cycle already exists
    const existingActiveCycle = await this.prisma.workoutCycle.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (existingActiveCycle) {
      throw new BadRequestException('Es existiert bereits ein aktiver Zyklus. Bitte beende diesen zuerst.');
    }

    const { name, duration, startDate, workoutDays } = createCycleDto;

    const cycle = await this.prisma.workoutCycle.create({
      data: {
        name,
        duration,
        startDate: new Date(startDate),
        userId,
        workoutDays: {
          create: workoutDays.map((day) => ({
            weekday: day.weekday,
            name: day.name,
            plannedHomeGymId: day.plannedHomeGymId || null,
            blueprint: {
              create: {
                exercises: {
                  create: day.exercises.map((ex) => ({
                    exerciseId: ex.exerciseId,
                    order: ex.order,
                    sets: {
                      create: ex.sets.map((set) => ({
                        order: set.order,
                        setType: set.setType,
                        reps: set.reps,
                        weight: set.weight,
                        rir: set.rir,
                        restAfterSet: set.restAfterSet || 90,
                      })),
                    },
                  })),
                },
              },
            },
          })),
        },
      },
      include: {
        workoutDays: {
          include: {
            plannedHomeGym: {
              select: { id: true, name: true },
            },
            blueprint: {
              include: {
                exercises: {
                  include: {
                    exercise: {
                      select: {
                        name: true,
                        isUnilateral: true,
                        isDoubleWeight: true,
                      },
                    },
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { weekday: 'asc' },
        },
      },
    });

    return this.mapCycleToResponse(cycle);
  }

  async update(
    id: string,
    updateCycleDto: UpdateCycleDto,
    userId: string,
  ): Promise<CycleResponseDto> {
    // Check ownership
    await this.findById(id, userId);

    const updatedCycle = await this.prisma.workoutCycle.update({
      where: { id },
      data: {
        ...(updateCycleDto.name && { name: updateCycleDto.name }),
        ...(updateCycleDto.duration && { duration: updateCycleDto.duration }),
        ...(updateCycleDto.startDate && { startDate: new Date(updateCycleDto.startDate) }),
      },
      include: {
        workoutDays: {
          include: {
            blueprint: {
              include: {
                exercises: {
                  include: {
                    exercise: {
                      select: {
                        name: true,
                        isUnilateral: true,
                        isDoubleWeight: true,
                      },
                    },
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { weekday: 'asc' },
        },
      },
    });

    return this.mapCycleToResponse(updatedCycle);
  }

  async updateBlueprint(
    cycleId: string,
    workoutDayId: string,
    updateBlueprintDto: UpdateBlueprintDto,
    userId: string,
  ): Promise<CycleResponseDto> {
    // Check ownership
    await this.findById(cycleId, userId);

    // Find workout day with blueprint
    const workoutDay = await this.prisma.workoutDay.findUnique({
      where: { id: workoutDayId },
      include: { blueprint: true },
    });

    if (!workoutDay || workoutDay.cycleId !== cycleId) {
      throw new NotFoundException('Workout day not found');
    }

    if (!workoutDay.blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    // Delete old blueprint exercises (cascades to sets)
    await this.prisma.blueprintExercise.deleteMany({
      where: { blueprintId: workoutDay.blueprint.id },
    });

    // Create new blueprint exercises with sets
    for (const ex of updateBlueprintDto.exercises) {
      await this.prisma.blueprintExercise.create({
        data: {
          blueprintId: workoutDay.blueprint.id,
          exerciseId: ex.exerciseId,
          order: ex.order,
          sets: {
            create: ex.sets.map((set) => ({
              order: set.order,
              setType: set.setType,
              reps: set.reps,
              weight: set.weight,
              rir: set.rir,
              restAfterSet: set.restAfterSet || 90,
            })),
          },
        },
      });
    }

    // Return updated cycle
    return this.findById(cycleId, userId);
  }

  async updateWorkoutDay(
    cycleId: string,
    workoutDayId: string,
    updateWorkoutDayDto: UpdateWorkoutDayDto,
    userId: string,
  ): Promise<CycleResponseDto> {
    // Check ownership
    await this.findById(cycleId, userId);

    // Find workout day
    const workoutDay = await this.prisma.workoutDay.findUnique({
      where: { id: workoutDayId },
    });

    if (!workoutDay || workoutDay.cycleId !== cycleId) {
      throw new NotFoundException('Workout day not found');
    }

    // Update workout day
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

    // Return updated cycle
    return this.findById(cycleId, userId);
  }

  async completeCycle(id: string, userId: string): Promise<CycleResponseDto> {
    // Check ownership
    const cycle = await this.findById(id, userId);

    if (cycle.status === 'COMPLETED') {
      throw new BadRequestException('Dieser Zyklus wurde bereits beendet.');
    }

    const updatedCycle = await this.prisma.workoutCycle.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        workoutDays: {
          include: {
            blueprint: {
              include: {
                exercises: {
                  include: {
                    exercise: {
                      select: {
                        name: true,
                        isUnilateral: true,
                        isDoubleWeight: true,
                      },
                    },
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { weekday: 'asc' },
        },
      },
    });

    return this.mapCycleToResponse(updatedCycle);
  }

  async delete(id: string, userId: string): Promise<void> {
    // Check ownership
    await this.findById(id, userId);

    await this.prisma.workoutCycle.delete({
      where: { id },
    });
  }

  private mapCycleToResponse(cycle: any): CycleResponseDto {
    return {
      id: cycle.id,
      name: cycle.name,
      duration: cycle.duration,
      startDate: cycle.startDate,
      createdAt: cycle.createdAt,
      status: cycle.status,
      completedAt: cycle.completedAt,
      workoutDays: cycle.workoutDays.map((day: any) => ({
        id: day.id,
        weekday: day.weekday,
        name: day.name,
        plannedHomeGymId: day.plannedHomeGymId,
        plannedHomeGym: day.plannedHomeGym ? { id: day.plannedHomeGym.id, name: day.plannedHomeGym.name } : undefined,
        blueprint: day.blueprint
          ? {
              id: day.blueprint.id,
              updatedAt: day.blueprint.updatedAt,
              exercises: day.blueprint.exercises.map((ex: any) => ({
                id: ex.id,
                exerciseId: ex.exerciseId,
                exerciseName: ex.exercise.name,
                isUnilateral: ex.exercise.isUnilateral,
                isDoubleWeight: ex.exercise.isDoubleWeight,
                order: ex.order,
                sets: ex.sets.map((set: any) => ({
                  id: set.id,
                  order: set.order,
                  setType: set.setType,
                  reps: set.reps,
                  weight: set.weight,
                  rir: set.rir,
                  restAfterSet: set.restAfterSet,
                })),
              })),
            }
          : undefined,
      })),
    };
  }
}
