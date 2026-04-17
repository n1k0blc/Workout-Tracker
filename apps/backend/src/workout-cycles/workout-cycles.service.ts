import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCycleDto,
  UpdateCycleDto,
  UpdateBlueprintDto,
  UpdateWorkoutDayDto,
  CycleResponseDto,
  CycleDetailsDto,
  WorkoutsByGymDto,
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

  /**
   * Get detailed statistics and data for a cycle
   */
  async getCycleDetails(id: string, userId: string): Promise<CycleDetailsDto> {
    // Check ownership and get cycle
    const cycle = await this.prisma.workoutCycle.findUnique({
      where: { id },
      include: {
        workoutDays: true,
      },
    });

    if (!cycle) {
      throw new NotFoundException('Zyklus nicht gefunden');
    }

    if (cycle.userId !== userId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    // Calculate end date
    const endDate = new Date(cycle.startDate);
    endDate.setDate(endDate.getDate() + cycle.duration * 7);

    // Get all workouts that belong to this cycle
    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        cycleId: id,
        status: 'COMPLETED',
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                isUnilateral: true,
                isDoubleWeight: true,
              },
            },
            sets: true,
          },
        },
        homeGym: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Calculate total volume (excluding warmup sets)
    let totalVolume = 0;
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const isUnilateral = exercise.exercise?.isUnilateral || false;
        const isDoubleWeight = exercise.exercise?.isDoubleWeight || false;

        for (const set of exercise.sets) {
          if (set.setType !== 'WARMUP') {
            let weight = set.weight;
            
            // Apply multipliers
            if (isUnilateral) {
              weight *= 2;
            }
            if (isDoubleWeight) {
              weight *= 2;
            }
            
            totalVolume += weight * set.reps;
          }
        }
      }
    }

    // Group workouts by gym
    const gymMap = new Map<string, { gymName: string; count: number; isHome: boolean }>();
    
    for (const workout of workouts) {
      if (workout.homeGym) {
        const key = workout.homeGym.id;
        if (gymMap.has(key)) {
          gymMap.get(key)!.count++;
        } else {
          gymMap.set(key, {
            gymName: workout.homeGym.name,
            count: 1,
            isHome: true,
          });
        }
      } else {
        // Other gyms
        const key = 'other';
        if (gymMap.has(key)) {
          gymMap.get(key)!.count++;
        } else {
          gymMap.set(key, {
            gymName: 'Andere Gyms',
            count: 1,
            isHome: false,
          });
        }
      }
    }

    const workoutsByGym: WorkoutsByGymDto[] = Array.from(gymMap.values());

    // Calculate current week for active cycles
    let currentWeek: number | undefined;
    let totalWeeks: number | undefined;
    let percentage: number | undefined;

    if (cycle.status === 'ACTIVE') {
      const now = new Date();
      const diffTime = now.getTime() - cycle.startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      currentWeek = Math.min(Math.floor(diffDays / 7) + 1, cycle.duration);
      totalWeeks = cycle.duration;
      percentage = Math.min((currentWeek / totalWeeks) * 100, 100);
      percentage = Math.round(percentage * 100) / 100; // 2 decimals
    }

    return {
      id: cycle.id,
      name: cycle.name,
      duration: cycle.duration,
      startDate: cycle.startDate,
      endDate,
      status: cycle.status,
      completedAt: cycle.completedAt,
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
