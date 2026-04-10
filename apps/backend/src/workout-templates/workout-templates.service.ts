import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WorkoutTemplateDto,
  WorkoutTemplateExerciseDto,
  WorkoutTemplateSetDto,
  CreateWorkoutTemplateDto,
  UpdateWorkoutTemplateDto,
} from './dto';

@Injectable()
export class WorkoutTemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string): Promise<WorkoutTemplateDto[]> {
    const templates = await this.prisma.workoutTemplate.findMany({
      where: {
        OR: [
          { isCustom: false }, // System templates
          { userId: userId }, // User's custom templates
        ],
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
            sets: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
    });

    return templates.map((template) => this.mapToDto(template));
  }

  async findOne(id: string, userId: string): Promise<WorkoutTemplateDto> {
    const template = await this.prisma.workoutTemplate.findUnique({
      where: { id },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
            sets: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Workout template not found');
    }

    // Check access: System templates are accessible to all, custom templates only to owner
    if (template.isCustom && template.userId !== userId) {
      throw new ForbiddenException('You do not have access to this template');
    }

    return this.mapToDto(template);
  }

  async create(userId: string, createDto: CreateWorkoutTemplateDto): Promise<WorkoutTemplateDto> {
    // Check for duplicate name (for this user)
    const existing = await this.prisma.workoutTemplate.findFirst({
      where: {
        userId: userId,
        name: createDto.name,
      },
    });

    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }

    // Verify all exercises exist
    const exerciseIds = createDto.exercises.map((e) => e.exerciseId);
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
    });

    if (exercises.length !== exerciseIds.length) {
      throw new NotFoundException('One or more exercises not found');
    }

    // Create template
    const template = await this.prisma.workoutTemplate.create({
      data: {
        name: createDto.name,
        isCustom: true,
        userId: userId,
        recommendedGymId: createDto.recommendedGymId,
        exercises: {
          create: createDto.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            order: exercise.order,
            sets: {
              create: exercise.sets,
            },
          })),
        },
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
            sets: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return this.mapToDto(template);
  }

  async update(id: string, userId: string, updateDto: UpdateWorkoutTemplateDto): Promise<WorkoutTemplateDto> {
    const template = await this.prisma.workoutTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Workout template not found');
    }

    if (!template.isCustom) {
      throw new ForbiddenException('System templates cannot be edited');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('You can only edit your own templates');
    }

    // Check for duplicate name (if name is being changed)
    if (updateDto.name && updateDto.name !== template.name) {
      const existing = await this.prisma.workoutTemplate.findFirst({
        where: {
          userId: userId,
          name: updateDto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('A template with this name already exists');
      }
    }

    // If exercises are being updated, verify they exist
    if (updateDto.exercises) {
      const exerciseIds = updateDto.exercises.map((e) => e.exerciseId);
      const exercises = await this.prisma.exercise.findMany({
        where: { id: { in: exerciseIds } },
      });

      if (exercises.length !== exerciseIds.length) {
        throw new NotFoundException('One or more exercises not found');
      }

      // Delete old exercises and create new ones
      await this.prisma.workoutTemplateExercise.deleteMany({
        where: { templateId: id },
      });
    }

    const updated = await this.prisma.workoutTemplate.update({
      where: { id },
      data: {
        name: updateDto.name,
        recommendedGymId: updateDto.recommendedGymId,
        ...(updateDto.exercises && {
          exercises: {
            create: updateDto.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              order: exercise.order,
              sets: {
                create: exercise.sets,
              },
            })),
          },
        }),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
            sets: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const template = await this.prisma.workoutTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Workout template not found');
    }

    if (!template.isCustom) {
      throw new ForbiddenException('System templates cannot be deleted');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('You can only delete your own templates');
    }

    await this.prisma.workoutTemplate.delete({
      where: { id },
    });
  }

  async createFromBlueprint(blueprintId: string, userId: string, name: string): Promise<WorkoutTemplateDto> {
    const blueprint = await this.prisma.workoutBlueprint.findUnique({
      where: { id: blueprintId },
      include: {
        workoutDay: {
          include: {
            cycle: true,
          },
        },
        exercises: {
          include: {
            exercise: true,
            sets: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    if (blueprint.workoutDay.cycle.userId !== userId) {
      throw new ForbiddenException('You can only create templates from your own blueprints');
    }

    // Check for duplicate name
    const existing = await this.prisma.workoutTemplate.findFirst({
      where: {
        userId: userId,
        name: name,
      },
    });

    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }

    // Create template from blueprint
    const template = await this.prisma.workoutTemplate.create({
      data: {
        name: name,
        isCustom: true,
        userId: userId,
        recommendedGymId: blueprint.workoutDay.plannedHomeGymId,
        exercises: {
          create: blueprint.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            order: exercise.order,
            sets: {
              create: exercise.sets.map((set) => ({
                order: set.order,
                isWarmup: set.setType === 'WARMUP',
                targetReps: set.reps,
                targetWeight: set.weight,
                targetRir: set.rir,
              })),
            },
          })),
        },
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
            sets: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return this.mapToDto(template);
  }

  async createFromWorkout(workoutId: string, userId: string, name: string): Promise<WorkoutTemplateDto> {
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        exercises: {
          include: {
            exercise: true,
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
      throw new ForbiddenException('You can only create templates from your own workouts');
    }

    if (workout.status !== 'COMPLETED') {
      throw new ForbiddenException('Only completed workouts can be saved as templates');
    }

    // Check for duplicate name
    const existing = await this.prisma.workoutTemplate.findFirst({
      where: {
        userId: userId,
        name: name,
      },
    });

    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }

    // Create template from workout
    const template = await this.prisma.workoutTemplate.create({
      data: {
        name: name,
        isCustom: true,
        userId: userId,
        recommendedGymId: workout.homeGymId,
        exercises: {
          create: workout.exercises.map((exerciseLog) => ({
            exerciseId: exerciseLog.exerciseId,
            order: exerciseLog.order,
            sets: {
              create: exerciseLog.sets.map((set, index) => ({
                order: index + 1, // 1-based order
                isWarmup: set.setType === 'WARMUP',
                targetReps: set.reps,
                targetWeight: set.weight,
                targetRir: set.rir || 0,
              })),
            },
          })),
        },
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
            sets: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return this.mapToDto(template);
  }

  private mapToDto(template: any): WorkoutTemplateDto {
    const exercisesData: WorkoutTemplateExerciseDto[] | undefined = template.exercises
      ? template.exercises.map((ex: any) => ({
          id: ex.id,
          order: ex.order,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exercise?.name,
          sets: ex.sets.map((set: any) => ({
            id: set.id,
            order: set.order,
            isWarmup: set.isWarmup,
            targetReps: set.targetReps,
            targetWeight: set.targetWeight,
            targetRir: set.targetRir,
          })),
        }))
      : undefined;

    return {
      id: template.id,
      name: template.name,
      isCustom: template.isCustom,
      userId: template.userId,
      recommendedGymId: template.recommendedGymId,
      createdAt: template.createdAt,
      exercises: exercisesData,
      totalExercises: exercisesData?.length,
      totalSets: exercisesData?.reduce((sum, ex) => sum + ex.sets.length, 0),
    };
  }
}
