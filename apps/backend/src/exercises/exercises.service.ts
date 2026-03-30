import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, FilterExerciseDto, ExerciseDto } from './dto';

@Injectable()
export class ExercisesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filterDto: FilterExerciseDto, userId?: string): Promise<ExerciseDto[]> {
    const { search, muscleGroup, equipment, includeCustom } = filterDto;

    // Build where clause
    const where: any = {
      OR: [
        { isCustom: false }, // Global exercises
        ...(includeCustom === 'true' && userId
          ? [{ isCustom: true, userId }] // User's custom exercises
          : []),
      ],
    };

    // Add filters
    if (muscleGroup) {
      where.muscleGroup = muscleGroup as any;
    }

    if (equipment) {
      where.equipment = equipment as any;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const exercises = await this.prisma.exercise.findMany({
      where,
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        isCustom: true,
        userId: true,
      },
      orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
    });

    return exercises as ExerciseDto[];
  }

  async findById(id: string, userId?: string): Promise<ExerciseDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        isCustom: true,
        userId: true,
      },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Check if user has access to this exercise
    if (exercise.isCustom && exercise.userId !== userId) {
      throw new NotFoundException('Exercise not found');
    }

    return exercise as ExerciseDto;
  }

  async create(
    createExerciseDto: CreateExerciseDto,
    userId: string,
  ): Promise<ExerciseDto> {
    const { name, muscleGroup, equipment } = createExerciseDto;

    // Check if custom exercise with same name already exists for this user
    const existingExercise = await this.prisma.exercise.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        userId,
        isCustom: true,
      },
    });

    if (existingExercise) {
      throw new ConflictException('You already have a custom exercise with this name');
    }

    const exercise = await this.prisma.exercise.create({
      data: {
        name,
        muscleGroup: muscleGroup as any,
        equipment: equipment as any,
        isCustom: true,
        userId,
      },
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        isCustom: true,
        userId: true,
      },
    });

    return exercise as ExerciseDto;
  }

  async delete(id: string, userId: string): Promise<void> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Only custom exercises can be deleted and only by their owner
    if (!exercise.isCustom || exercise.userId !== userId) {
      throw new ConflictException('You can only delete your own custom exercises');
    }

    await this.prisma.exercise.delete({
      where: { id },
    });
  }
}
