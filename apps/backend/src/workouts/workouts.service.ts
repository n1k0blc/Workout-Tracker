import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  StartWorkoutDto,
  LogSetDto,
  UpdateSetDto,
  AddExerciseToWorkoutDto,
  CompleteWorkoutDto,
  UpdateCompletedWorkoutDto,
  WorkoutResponseDto,
  WorkoutListItemDto,
  WorkoutStatus,
  GymLocation,
} from './dto';

@Injectable()
export class WorkoutsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: string,
    status?: WorkoutStatus,
    startDate?: Date,
    endDate?: Date,
  ): Promise<WorkoutListItemDto[]> {
    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.gte = startDate;
      dateFilter.lte = endDate;
    } else if (startDate) {
      dateFilter.gte = startDate;
    } else if (endDate) {
      dateFilter.lte = endDate;
    }

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        // If no status specified, exclude DISCARDED workouts by default
        ...(status ? { status: status as any } : { status: { not: 'DISCARDED' as any } }),
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      include: {
        cycle: {
          select: { name: true },
        },
        workoutDay: {
          select: { name: true },
        },
        exercises: {
          select: { id: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return workouts.map((workout) => ({
      id: workout.id,
      date: workout.date,
      status: workout.status as WorkoutStatus,
      isFreeWorkout: workout.isFreeWorkout,
      totalDuration: workout.totalDuration,
      gymLocation: workout.gymLocation as GymLocation,
      cycleName: workout.cycle?.name,
      workoutDayName: workout.workoutDay?.name,
      exerciseCount: workout.exercises.length,
      createdAt: workout.createdAt,
    }));
  }

  async findActive(userId: string): Promise<WorkoutResponseDto | null> {
    const workout = await this.prisma.workout.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS' as any,
      },
      include: {
        cycle: {
          select: { name: true },
        },
        workoutDay: {
          select: { 
            name: true,
            blueprint: {
              include: {
                exercises: {
                  include: {
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        exercises: {
          include: {
            exercise: {
              select: { name: true, isUnilateral: true, isDoubleWeight: true },
            },
            sets: {
              orderBy: { setNumber: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });

    if (!workout) {
      return null;
    }

    return this.mapWorkoutToResponse(workout);
  }

  async findById(id: string, userId: string): Promise<WorkoutResponseDto> {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: {
        cycle: {
          select: { name: true },
        },
        workoutDay: {
          select: { 
            name: true,
            blueprint: {
              include: {
                exercises: {
                  include: {
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        exercises: {
          include: {
            exercise: {
              select: { name: true, isUnilateral: true, isDoubleWeight: true },
            },
            sets: {
              orderBy: { setNumber: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    if (workout.userId !== userId) {
      throw new NotFoundException('Workout not found');
    }

    return this.mapWorkoutToResponse(workout);
  }

  async start(startWorkoutDto: StartWorkoutDto, userId: string): Promise<WorkoutResponseDto> {
    const { isFreeWorkout, cycleId, workoutDayId, exercises, gymLocation, isPastWorkout, pastWorkoutDate } = startWorkoutDto;

    // Validate: If not free workout, cycleId and workoutDayId must be provided
    if (!isFreeWorkout && (!cycleId || !workoutDayId)) {
      throw new BadRequestException(
        'cycleId and workoutDayId are required for non-free workouts',
      );
    }

    // Load exercises from blueprint if starting a cycle workout without explicit exercises
    let exercisesToCreate = exercises;
    let blueprintData = null;
    if (!isFreeWorkout && cycleId && workoutDayId && (!exercises || exercises.length === 0)) {
      const workoutDay = await this.prisma.workoutDay.findUnique({
        where: { id: workoutDayId },
        include: {
          blueprint: {
            include: {
              exercises: {
                include: {
                  sets: {
                    orderBy: { order: 'asc' },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      if (workoutDay?.blueprint?.exercises) {
        blueprintData = workoutDay.blueprint;
        exercisesToCreate = workoutDay.blueprint.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          order: ex.order,
        }));
      }
    }

    const workout = await this.prisma.workout.create({
      data: {
        userId,
        date: isPastWorkout && pastWorkoutDate ? new Date(pastWorkoutDate) : new Date(),
        status: 'IN_PROGRESS' as any,
        isFreeWorkout: isFreeWorkout ?? false,
        gymLocation: gymLocation,
        cycleId: cycleId || null,
        workoutDayId: workoutDayId || null,
        ...(exercisesToCreate &&
          exercisesToCreate.length > 0 && {
            exercises: {
              create: exercisesToCreate.map((ex) => ({
                exerciseId: ex.exerciseId,
                order: ex.order,
              })),
            },
          }),
      },
      include: {
        cycle: {
          select: { name: true },
        },
        workoutDay: {
          select: { 
            name: true,
            blueprint: {
              include: {
                exercises: {
                  include: {
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        exercises: {
          include: {
            exercise: {
              select: { name: true, isUnilateral: true, isDoubleWeight: true },
            },
            sets: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return this.mapWorkoutToResponse(workout);
  }

  async addExercise(
    workoutId: string,
    addExerciseDto: AddExerciseToWorkoutDto,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    // Check workout ownership and status
    const workout = await this.findById(workoutId, userId);
    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify a completed or discarded workout');
    }

    // If order not provided, calculate it
    let order = addExerciseDto.order;
    if (!order) {
      const existingExercises = await this.prisma.exerciseLog.findMany({
        where: { workoutId },
        orderBy: { order: 'desc' },
        take: 1,
      });
      order = existingExercises.length > 0 ? existingExercises[0].order + 1 : 1;
    }

    await this.prisma.exerciseLog.create({
      data: {
        workoutId,
        exerciseId: addExerciseDto.exerciseId,
        order,
      },
    });

    return this.findById(workoutId, userId);
  }

  async removeExercise(
    workoutId: string,
    exerciseLogId: string,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    // Check workout ownership and status
    const workout = await this.findById(workoutId, userId);
    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify a completed or discarded workout');
    }

    await this.prisma.exerciseLog.delete({
      where: { id: exerciseLogId },
    });

    return this.findById(workoutId, userId);
  }

  async reorderExercises(
    workoutId: string,
    exerciseIds: string[],
    userId: string,
  ): Promise<WorkoutResponseDto> {
    // Check workout ownership and status
    const workout = await this.findById(workoutId, userId);
    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify a completed or discarded workout');
    }

    // Update order for each exercise
    await Promise.all(
      exerciseIds.map((exerciseId, index) =>
        this.prisma.exerciseLog.updateMany({
          where: {
            id: exerciseId,
            workoutId,
          },
          data: {
            order: index + 1,
          },
        }),
      ),
    );

    return this.findById(workoutId, userId);
  }

  async logSet(
    workoutId: string,
    exerciseLogId: string,
    logSetDto: LogSetDto,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    // Check workout ownership and status
    const workout = await this.findById(workoutId, userId);
    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify a completed or discarded workout');
    }

    // Check if exercise log belongs to workout
    const exerciseLog = await this.prisma.exerciseLog.findUnique({
      where: { id: exerciseLogId },
    });

    if (!exerciseLog || exerciseLog.workoutId !== workoutId) {
      throw new NotFoundException('Exercise log not found');
    }

    await this.prisma.setLog.create({
      data: {
        exerciseLogId,
        setNumber: logSetDto.setNumber,
        reps: logSetDto.reps,
        weight: logSetDto.weight,
        rir: logSetDto.rir,
        setType: logSetDto.setType,
        targetReps: logSetDto.targetReps,
        targetWeight: logSetDto.targetWeight,
        targetRir: logSetDto.targetRir,
        actualRestDuration: logSetDto.actualRestDuration,
      },
    });

    return this.findById(workoutId, userId);
  }

  async deleteSet(
    workoutId: string,
    setLogId: string,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    // Check workout ownership and status
    const workout = await this.findById(workoutId, userId);
    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify a completed or discarded workout');
    }

    await this.prisma.setLog.delete({
      where: { id: setLogId },
    });

    return this.findById(workoutId, userId);
  }

  async updateSet(
    workoutId: string,
    setLogId: string,
    updateSetDto: UpdateSetDto,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    // Check workout ownership and status
    const workout = await this.findById(workoutId, userId);
    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify a completed or discarded workout');
    }

    // Verify setLog belongs to this workout
    const setLog = await this.prisma.setLog.findUnique({
      where: { id: setLogId },
      include: {
        exerciseLog: true,
      },
    });

    if (!setLog || setLog.exerciseLog.workoutId !== workoutId) {
      throw new NotFoundException('Set log not found');
    }

    await this.prisma.setLog.update({
      where: { id: setLogId },
      data: {
        reps: updateSetDto.reps,
        weight: updateSetDto.weight,
        rir: updateSetDto.rir,
      },
    });

    return this.findById(workoutId, userId);
  }

  async replaceExercise(
    workoutId: string,
    exerciseLogId: string,
    newExerciseId: string,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    // Check workout ownership and status
    const workout = await this.findById(workoutId, userId);
    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify a completed or discarded workout');
    }

    // Get full workout data with blueprint to access planned sets
    const fullWorkout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        workoutDay: {
          include: {
            blueprint: {
              include: {
                exercises: {
                  include: {
                    sets: {
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        exercises: {
          include: {
            sets: true,
          },
        },
      },
    });

    // Find the exercise log
    const exerciseLog = fullWorkout.exercises.find(ex => ex.id === exerciseLogId);
    if (!exerciseLog) {
      throw new NotFoundException('Exercise log not found');
    }

    // Check if any sets have been logged
    if (exerciseLog.sets.length > 0) {
      throw new BadRequestException('Cannot replace exercise after sets have been logged');
    }

    // Get the planned sets from the blueprint for the OLD exercise
    const blueprint = fullWorkout.workoutDay?.blueprint;
    let customPlannedSets = null;

    if (blueprint) {
      const blueprintExercise = blueprint.exercises.find(
        (bpEx: any) => bpEx.exerciseId === exerciseLog.exerciseId
      );
      
      if (blueprintExercise && blueprintExercise.sets) {
        // Save the planned sets structure to preserve it for the new exercise
        customPlannedSets = blueprintExercise.sets.map((bpSet: any) => ({
          order: bpSet.order,
          setType: bpSet.setType,
          reps: bpSet.reps,
          weight: bpSet.weight,
          rir: bpSet.rir,
          restAfterSet: bpSet.restAfterSet,
        }));
      }
    }

    // Update the exercise reference and save custom planned sets
    await this.prisma.exerciseLog.update({
      where: { id: exerciseLogId },
      data: {
        exerciseId: newExerciseId,
        customPlannedSets: customPlannedSets ? customPlannedSets : undefined,
      },
    });

    return this.findById(workoutId, userId);
  }

  async complete(
    workoutId: string,
    completeWorkoutDto: CompleteWorkoutDto,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    const workout = await this.findById(workoutId, userId);

    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Workout is not in progress');
    }

    // Update workout status
    await this.prisma.workout.update({
      where: { id: workoutId },
      data: {
        status: 'COMPLETED' as any,
        totalDuration: completeWorkoutDto.totalDuration,
      },
    });

    // Update blueprint if requested (only for HOME gym workouts)
    if (completeWorkoutDto.updateBlueprint && workout.workoutDayId && workout.gymLocation === 'HOME') {
      await this.updateBlueprintFromWorkout(workoutId, workout.workoutDayId);
    }

    return this.findById(workoutId, userId);
  }

  async updateCompletedWorkout(
    workoutId: string,
    updateDto: UpdateCompletedWorkoutDto,
    userId: string,
  ): Promise<WorkoutResponseDto> {
    const workout = await this.findById(workoutId, userId);

    if (workout.status !== WorkoutStatus.COMPLETED) {
      throw new BadRequestException('Only completed workouts can be edited');
    }

    // Update workout date if provided
    if (updateDto.completedAt) {
      await this.prisma.workout.update({
        where: { id: workoutId },
        data: {
          date: new Date(updateDto.completedAt),
        },
      });
    }

    // Update sets
    for (const exerciseUpdate of updateDto.exercises) {
      for (const setUpdate of exerciseUpdate.sets) {
        await this.prisma.setLog.update({
          where: { id: setUpdate.id },
          data: {
            reps: setUpdate.reps,
            weight: setUpdate.weight,
            rir: setUpdate.rir,
          },
        });
      }
    }

    return this.findById(workoutId, userId);
  }

  private async updateBlueprintFromWorkout(
    workoutId: string,
    workoutDayId: string,
  ): Promise<void> {
    // Get workout with all exercises and sets
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        exercises: {
          include: {
            sets: {
              orderBy: { setNumber: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        workoutDay: {
          include: {
            blueprint: true,
          },
        },
      },
    });

    if (!workout || !workout.workoutDay?.blueprint) {
      return;
    }

    const blueprintId = workout.workoutDay.blueprint.id;

    // Delete old blueprint exercises
    await this.prisma.blueprintExercise.deleteMany({
      where: { blueprintId },
    });

    // Create new blueprint exercises from workout
    for (const exerciseLog of workout.exercises) {
      if (exerciseLog.sets.length === 0) continue;

      await this.prisma.blueprintExercise.create({
        data: {
          blueprintId,
          exerciseId: exerciseLog.exerciseId,
          order: exerciseLog.order,
          sets: {
            create: exerciseLog.sets.map((setLog) => ({
              order: setLog.setNumber,
              setType: setLog.setType || 'WORKING',
              reps: setLog.reps,
              weight: setLog.weight,
              rir: setLog.rir || 0,
              restAfterSet: setLog.actualRestDuration || 90, // Use actual rest or default
            })),
          },
        },
      });
    }
  }

  async discard(workoutId: string, userId: string): Promise<void> {
    const workout = await this.findById(workoutId, userId);

    if (workout.status !== WorkoutStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only discard workouts in progress');
    }

    await this.prisma.workout.update({
      where: { id: workoutId },
      data: {
        status: 'DISCARDED' as any,
      },
    });
  }

  private mapWorkoutToResponse(workout: any): WorkoutResponseDto {
    // Get blueprint exercises if available
    const blueprintExercisesMap = new Map();
    if (workout.workoutDay?.blueprint?.exercises) {
      workout.workoutDay.blueprint.exercises.forEach((bpEx: any) => {
        blueprintExercisesMap.set(bpEx.exerciseId, bpEx);
      });
    }

    return {
      id: workout.id,
      date: workout.date,
      status: workout.status as WorkoutStatus,
      isFreeWorkout: workout.isFreeWorkout,
      totalDuration: workout.totalDuration,
      gymLocation: workout.gymLocation as GymLocation,
      cycleId: workout.cycleId,
      cycleName: workout.cycle?.name,
      workoutDayId: workout.workoutDayId,
      workoutDayName: workout.workoutDay?.name,
      exercises: workout.exercises.map((ex: any) => {
        const blueprintExercise = blueprintExercisesMap.get(ex.exerciseId);
        
        // Use custom planned sets if exercise was replaced, otherwise use blueprint
        let plannedSets;
        
        if (ex.customPlannedSets) {
          // Exercise was replaced - use saved planned sets structure
          // Need to add IDs for frontend compatibility
          plannedSets = (ex.customPlannedSets as any[]).map((set: any, idx: number) => ({
            id: `custom-${ex.id}-${idx}`,
            order: set.order,
            setType: set.setType,
            reps: set.reps,
            weight: set.weight,
            rir: set.rir,
            restAfterSet: set.restAfterSet,
          }));
        } else if (blueprintExercise?.sets) {
          // Use blueprint planned sets
          plannedSets = blueprintExercise.sets.map((bpSet: any) => ({
            id: bpSet.id,
            order: bpSet.order,
            setType: bpSet.setType,
            reps: bpSet.reps,
            weight: bpSet.weight,
            rir: bpSet.rir,
            restAfterSet: bpSet.restAfterSet,
          }));
        }
        
        return {
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exercise.name,
          isUnilateral: ex.exercise.isUnilateral,
          isDoubleWeight: ex.exercise.isDoubleWeight,
          order: ex.order,
          sets: ex.sets.map((set: any) => ({
            id: set.id,
            setNumber: set.setNumber,
            setType: set.setType,
            reps: set.reps,
            weight: set.weight,
            rir: set.rir,
            targetReps: set.targetReps,
            targetWeight: set.targetWeight,
            targetRir: set.targetRir,
            completedAt: set.completedAt,
            actualRestDuration: set.actualRestDuration,
          })),
          plannedSets,
        };
      }),
      createdAt: workout.createdAt,
    };
  }
}
