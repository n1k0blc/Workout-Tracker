import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, FilterExerciseDto, ExerciseDto, UpdateExerciseDto } from './dto';
import {
  MusclePercentages,
  derivePrimaryMuscle,
  sumMusclePercentages,
  MUSCLE_PERCENT_FIELD,
} from '../common/muscle.util';
import type { ExerciseShape } from '../workout-tree/workout-tree.service';

const EXERCISE_SELECT = {
  id: true,
  name: true,
  equipment: true,
  isUnilateral: true,
  isDoubleWeight: true,
  isCustom: true,
  userId: true,
  deletedAt: true,
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
} as const;

type ExerciseRow = {
  id: string;
  name: string;
  equipment: string;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
  isCustom: boolean;
  userId: string | null;
  deletedAt: Date | null;
} & MusclePercentages;

function toDto(exercise: ExerciseRow, inUse: boolean): ExerciseDto {
  const { deletedAt: _deletedAt, ...rest } = exercise;
  return {
    ...rest,
    userId: rest.userId ?? undefined,
    primaryMuscle: derivePrimaryMuscle(exercise),
    inUse,
  } as ExerciseDto;
}

@Injectable()
export class ExercisesService {
  constructor(private prisma: PrismaService) {}

  /**
   * BOLA guard (§2.1/§3.1): confirms every referenced exercise exists, isn't soft-deleted,
   * and is either a system exercise or owned by `userId` -- callers building a workout/
   * blueprint/template tree from client-submitted exerciseIds must not trust those ids
   * blindly (a plain existence-only check would let a user reference another user's
   * private custom exercise and read its name back out via the tree they just created).
   *
   * Returns the accessible exercises keyed by id, so the same load also feeds the set-shape
   * check in `toExerciseInputs` (issue #100) rather than making the write path query twice.
   */
  async validateAccessible(
    exerciseIds: string[],
    userId: string,
  ): Promise<Map<string, ExerciseShape>> {
    const uniqueIds = Array.from(new Set(exerciseIds));
    if (uniqueIds.length === 0) return new Map();

    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null },
      select: { id: true, name: true, isCustom: true, isUnilateral: true, userId: true },
    });

    const accessible = exercises.filter((e) => !e.isCustom || e.userId === userId);
    const accessibleIds = new Set(accessible.map((e) => e.id));

    if (uniqueIds.some((id) => !accessibleIds.has(id))) {
      throw new NotFoundException('One or more exercises not found');
    }

    return new Map(
      accessible.map((e) => [e.id, { isUnilateral: e.isUnilateral, name: e.name }]),
    );
  }

  /**
   * Of the given ids, those referenced by at least one WorkoutSet -- across every
   * workout kind (performed, template, blueprint; they share the table). Gates the
   * `isUnilateral` toggle: an exercise that changed shape is a different exercise
   * (issue #98/#65).
   */
  private async findInUseIds(exerciseIds: string[]): Promise<Set<string>> {
    if (exerciseIds.length === 0) return new Set();
    const rows = await this.prisma.workoutExercise.findMany({
      where: { exerciseId: { in: exerciseIds }, sets: { some: {} } },
      select: { exerciseId: true },
      distinct: ['exerciseId'],
    });
    return new Set(rows.map((r) => r.exerciseId));
  }

  /** Single-id form of {@link findInUseIds} -- shares its predicate so the two can't drift. */
  private async isInUse(exerciseId: string): Promise<boolean> {
    return (await this.findInUseIds([exerciseId])).has(exerciseId);
  }

  /**
   * Validates that muscle group percentages sum to 100.
   * If no percentages are provided, sets 100% on `primaryMuscle` as a creation convenience
   * (the percent distribution itself remains the single source of truth -- §3.7).
   */
  private validateAndNormalizeMusclePercentages(
    dto: CreateExerciseDto | UpdateExerciseDto,
  ): MusclePercentages {
    const percentages: MusclePercentages = {
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

    const sum = sumMusclePercentages(percentages);

    if (sum === 0) {
      if (!dto.primaryMuscle) {
        throw new BadRequestException(
          'Provide either muscle percentages summing to 100%, or a primaryMuscle',
        );
      }
      const field = MUSCLE_PERCENT_FIELD[dto.primaryMuscle] as keyof MusclePercentages;
      percentages[field] = 100;
      return percentages;
    }

    if (sum !== 100) {
      throw new BadRequestException(
        `Muscle group percentages must sum to 100%. Current sum: ${sum}%`,
      );
    }

    return percentages;
  }

  async findAll(filterDto: FilterExerciseDto, userId?: string): Promise<ExerciseDto[]> {
    const { search, primaryMuscle, equipment, includeCustom } = filterDto;

    const where: any = {
      deletedAt: null,
      OR: [
        { isCustom: false }, // Global exercises
        ...(includeCustom === 'true' && userId
          ? [{ isCustom: true, userId }] // User's custom exercises
          : []),
      ],
    };

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
      select: EXERCISE_SELECT,
      orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
    });

    const inUseIds = await this.findInUseIds(exercises.map((e) => e.id));
    const dtos = exercises.map((e) =>
      toDto(e as ExerciseRow, inUseIds.has(e.id)),
    );
    return primaryMuscle ? dtos.filter((e) => e.primaryMuscle === primaryMuscle) : dtos;
  }

  async findById(id: string, userId?: string): Promise<ExerciseDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      select: EXERCISE_SELECT,
    });

    if (!exercise || exercise.deletedAt) {
      throw new NotFoundException('Exercise not found');
    }

    // Check if user has access to this exercise
    if (exercise.isCustom && exercise.userId !== userId) {
      throw new NotFoundException('Exercise not found');
    }

    return toDto(exercise as ExerciseRow, await this.isInUse(id));
  }

  async create(
    createExerciseDto: CreateExerciseDto,
    userId: string,
  ): Promise<ExerciseDto> {
    const { name, equipment, isUnilateral, isDoubleWeight } = createExerciseDto;

    // Check if custom exercise with same name already exists for this user
    const existingExercise = await this.prisma.exercise.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        userId,
        isCustom: true,
        deletedAt: null,
      },
    });

    if (existingExercise) {
      throw new ConflictException('You already have a custom exercise with this name');
    }

    const percentages = this.validateAndNormalizeMusclePercentages(createExerciseDto);

    const exercise = await this.prisma.exercise.create({
      data: {
        name,
        equipment: equipment as any,
        isUnilateral: isUnilateral ?? false,
        isDoubleWeight: isDoubleWeight ?? false,
        isCustom: true,
        userId,
        ...percentages,
      },
      select: EXERCISE_SELECT,
    });

    return toDto(exercise as ExerciseRow, false);
  }

  async delete(id: string, userId: string): Promise<void> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
    });

    if (!exercise || exercise.deletedAt) {
      throw new NotFoundException('Exercise not found');
    }

    // A custom exercise owned by someone else: 404, not 409 -- don't leak that it exists.
    if (exercise.isCustom && exercise.userId !== userId) {
      throw new NotFoundException('Exercise not found');
    }

    // System exercises are public, read-only data -- this isn't an ownership leak.
    if (!exercise.isCustom) {
      throw new ConflictException('System exercises cannot be deleted');
    }

    await this.prisma.exercise.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async update(id: string, userId: string, updateDto: UpdateExerciseDto): Promise<ExerciseDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
    });

    if (!exercise || exercise.deletedAt) {
      throw new NotFoundException('Exercise not found');
    }

    if (exercise.isCustom && exercise.userId !== userId) {
      throw new NotFoundException('Exercise not found');
    }

    if (!exercise.isCustom) {
      throw new ConflictException('System exercises cannot be modified');
    }

    const inUse = await this.isInUse(id);

    if (
      updateDto.isUnilateral !== undefined &&
      updateDto.isUnilateral !== exercise.isUnilateral &&
      inUse
    ) {
      throw new ConflictException(
        'Diese Übung wird bereits in Sätzen verwendet – unilateral lässt sich nicht mehr ändern. Lege dafür eine neue Übung an.',
      );
    }

    const percentages = this.validateAndNormalizeMusclePercentages(updateDto);

    const updated = await this.prisma.exercise.update({
      where: { id },
      data: {
        name: updateDto.name,
        equipment: updateDto.equipment,
        isUnilateral: updateDto.isUnilateral,
        isDoubleWeight: updateDto.isDoubleWeight,
        ...percentages,
      },
      select: EXERCISE_SELECT,
    });

    return toDto(updated as ExerciseRow, inUse);
  }
}
