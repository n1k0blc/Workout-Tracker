import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, FilterExerciseDto, ExerciseDto, UpdateExerciseDto } from './dto';

@Injectable()
export class ExercisesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validates that muscle group percentages sum to 100
   * If percentages are not provided, sets 100% on main muscle group
   */
  private validateAndNormalizeMusclePercentages(
    dto: CreateExerciseDto | UpdateExerciseDto,
  ): {
    abdomenPercent: number;
    latissimusPercent: number;
    trapeziusPercent: number;
    lowerBackPercent: number;
    hamstringsPercent: number;
    glutesPercent: number;
    shouldersPercent: number;
    bicepsPercent: number;
    chestPercent: number;
    quadricepsPercent: number;
    calvesPercent: number;
    tricepsPercent: number;
  } {
    const percentages = {
      abdomenPercent: dto.abdomenPercent ?? 0,
      latissimusPercent: dto.latissimusPercent ?? 0,
      trapeziusPercent: dto.trapeziusPercent ?? 0,
      lowerBackPercent: dto.lowerBackPercent ?? 0,
      hamstringsPercent: dto.hamstringsPercent ?? 0,
      glutesPercent: dto.glutesPercent ?? 0,
      shouldersPercent: dto.shouldersPercent ?? 0,
      bicepsPercent: dto.bicepsPercent ?? 0,
      chestPercent: dto.chestPercent ?? 0,
      quadricepsPercent: dto.quadricepsPercent ?? 0,
      calvesPercent: dto.calvesPercent ?? 0,
      tricepsPercent: dto.tricepsPercent ?? 0,
    };

    const sum =
      percentages.abdomenPercent +
      percentages.latissimusPercent +
      percentages.trapeziusPercent +
      percentages.lowerBackPercent +
      percentages.hamstringsPercent +
      percentages.glutesPercent +
      percentages.shouldersPercent +
      percentages.bicepsPercent +
      percentages.chestPercent +
      percentages.quadricepsPercent +
      percentages.calvesPercent +
      percentages.tricepsPercent;

    // If no percentages provided, set 100% on main muscle group
    if (sum === 0) {
      const muscleGroup = dto.muscleGroup;
      const muscleGroupToField: Record<string, keyof typeof percentages> = {
        ABDOMEN: 'abdomenPercent',
        ABS: 'abdomenPercent',
        LATISSIMUS: 'latissimusPercent',
        BACK: 'latissimusPercent',
        TRAPEZIUS: 'trapeziusPercent',
        LOWER_BACK: 'lowerBackPercent',
        HAMSTRINGS: 'hamstringsPercent',
        GLUTES: 'glutesPercent',
        SHOULDERS: 'shouldersPercent',
        BICEPS: 'bicepsPercent',
        CHEST: 'chestPercent',
        QUADRICEPS: 'quadricepsPercent',
        LEGS: 'quadricepsPercent',
        CALVES: 'calvesPercent',
        TRICEPS: 'tricepsPercent',
      };

      const field = muscleGroupToField[muscleGroup];
      if (field) {
        percentages[field] = 100;
      }

      return percentages;
    }

    // If percentages provided, validate sum is 100
    if (sum !== 100) {
      throw new BadRequestException(
        `Muscle group percentages must sum to 100%. Current sum: ${sum}%`,
      );
    }

    return percentages;
  }

  async findAll(filterDto: FilterExerciseDto, userId?: string): Promise<ExerciseDto[]> {
    const { search, muscleGroup, equipment, includeCustom } = filterDto;

    // Build where clause
    const where: any = {
      deletedAt: null, // Filter soft-deleted exercises
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
        isUnilateral: true,
        isDoubleWeight: true,
        isCustom: true,
        userId: true,
        abdomenPercent: true,
        latissimusPercent: true,
        trapeziusPercent: true,
        lowerBackPercent: true,
        hamstringsPercent: true,
        glutesPercent: true,
        shouldersPercent: true,
        bicepsPercent: true,
        chestPercent: true,
        quadricepsPercent: true,
        calvesPercent: true,
        tricepsPercent: true,
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
        isUnilateral: true,
        isDoubleWeight: true,
        isCustom: true,
        userId: true,
        abdomenPercent: true,
        latissimusPercent: true,
        trapeziusPercent: true,
        lowerBackPercent: true,
        hamstringsPercent: true,
        glutesPercent: true,
        shouldersPercent: true,
        bicepsPercent: true,
        chestPercent: true,
        quadricepsPercent: true,
        calvesPercent: true,
        tricepsPercent: true,
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
    const { name, muscleGroup, equipment, isUnilateral, isDoubleWeight } = createExerciseDto;

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

    // Validate and normalize muscle percentages
    const percentages = this.validateAndNormalizeMusclePercentages(createExerciseDto);

    const exercise = await this.prisma.exercise.create({
      data: {
        name,
        muscleGroup: muscleGroup as any,
        equipment: equipment as any,
        isUnilateral: isUnilateral ?? false,
        isDoubleWeight: isDoubleWeight ?? false,
        isCustom: true,
        userId,
        ...percentages,
      },
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        isUnilateral: true,
        isDoubleWeight: true,
        isCustom: true,
        userId: true,
        abdomenPercent: true,
        latissimusPercent: true,
        trapeziusPercent: true,
        lowerBackPercent: true,
        hamstringsPercent: true,
        glutesPercent: true,
        shouldersPercent: true,
        bicepsPercent: true,
        chestPercent: true,
        quadricepsPercent: true,
        calvesPercent: true,
        tricepsPercent: true,
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

    // Soft-delete instead of hard-delete to prevent FK constraint errors
    await this.prisma.exercise.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async update(id: string, userId: string, updateDto: UpdateExerciseDto): Promise<ExerciseDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Only custom exercises can be updated and only by their owner
    if (!exercise.isCustom || exercise.userId !== userId) {
      throw new ConflictException('You can only update your own custom exercises');
    }

    // Validate and normalize muscle percentages
    const percentages = this.validateAndNormalizeMusclePercentages(updateDto);

    const updated = await this.prisma.exercise.update({
      where: { id },
      data: {
        name: updateDto.name,
        muscleGroup: updateDto.muscleGroup,
        equipment: updateDto.equipment,
        isUnilateral: updateDto.isUnilateral,
        isDoubleWeight: updateDto.isDoubleWeight,
        ...percentages,
      },
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        isUnilateral: true,
        isDoubleWeight: true,
        isCustom: true,
        userId: true,
        abdomenPercent: true,
        latissimusPercent: true,
        trapeziusPercent: true,
        lowerBackPercent: true,
        hamstringsPercent: true,
        glutesPercent: true,
        shouldersPercent: true,
        bicepsPercent: true,
        chestPercent: true,
        quadricepsPercent: true,
        calvesPercent: true,
        tricepsPercent: true,
      },
    });

    return updated as ExerciseDto;
  }
}
