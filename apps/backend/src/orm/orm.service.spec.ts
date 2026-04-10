import { Test, TestingModule } from '@nestjs/testing';
import { ORMService } from './orm.service';
import { PrismaService } from '../prisma/prisma.service';
import { SetLog, Exercise } from '@prisma/client';

describe('ORMService', () => {
  let service: ORMService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ORMService,
        {
          provide: PrismaService,
          useValue: {}, // Mock Prisma
        },
      ],
    }).compile();

    service = module.get<ORMService>(ORMService);
  });

  describe('calculateSetORM', () => {
    it('should calculate ORM correctly for normal set', () => {
      const set = {
        reps: 10,
        weight: 70,
        rir: 2,
      } as SetLog;

      const exercise = {
        isDoubleWeight: false,
      } as Exercise;

      const orm = service.calculateSetORM(set, exercise);

      // 70 × (1 + (10 + 2) / 30) = 70 × 1.4 = 98
      expect(orm).toBeCloseTo(98, 1);
    });

    it('should handle double weight exercises', () => {
      const set = {
        reps: 8,
        weight: 30,
        rir: 2,
      } as SetLog;

      const exercise = {
        isDoubleWeight: true,
      } as Exercise;

      const orm = service.calculateSetORM(set, exercise);

      // (30 × 2) × (1 + (8 + 2) / 30) = 60 × 1.333 = 80
      expect(orm).toBeCloseTo(80, 1);
    });

    it('should treat null RIR as 0', () => {
      const set = {
        reps: 8,
        weight: 80,
        rir: null,
      } as SetLog;

      const exercise = {
        isDoubleWeight: false,
      } as Exercise;

      const orm = service.calculateSetORM(set, exercise);

      // 80 × (1 + (8 + 0) / 30) = 80 × 1.267 = 101.33
      expect(orm).toBeCloseTo(101.33, 1);
    });
  });

  describe('calculateExerciseBenchmark', () => {
    it('should calculate average ORM from multiple sets', () => {
      const sets = [
        { reps: 10, weight: 70, rir: 2 },
        { reps: 8, weight: 80, rir: 0 },
      ] as SetLog[];

      const exercise = { isDoubleWeight: false } as Exercise;

      const benchmark = service.calculateExerciseBenchmark(sets, exercise);

      // Set 1: 70 × (1 + 12/30) = 98
      // Set 2: 80 × (1 + 8/30) = 101.33
      // Average: (98 + 101.33) / 2 = 99.665
      expect(benchmark).toBeCloseTo(99.665, 1);
    });

    it('should return null for empty working sets', () => {
      const benchmark = service.calculateExerciseBenchmark(
        [],
        {} as Exercise,
      );

      expect(benchmark).toBeNull();
    });
  });

  describe('calculateExercisePercentORM', () => {
    it('should calculate %ORM correctly', () => {
      const sets = [
        { reps: 10, weight: 70, rir: 2 },
        { reps: 8, weight: 80, rir: 0 },
      ] as SetLog[];

      const exercise = { isDoubleWeight: false } as Exercise;
      const benchmark = 99.65;

      const percentORM = service.calculateExercisePercentORM(
        sets,
        benchmark,
        exercise,
      );

      // Set 1: 70 / 99.65 = 0.702 = 70.2%
      // Set 2: 80 / 99.65 = 0.802 = 80.2%
      // Average: 75.2%
      expect(percentORM).toBeCloseTo(75.2, 1);
    });

    it('should handle double weight in %ORM calculation', () => {
      const sets = [{ reps: 8, weight: 30, rir: 0 }] as SetLog[];

      const exercise = { isDoubleWeight: true } as Exercise;
      const benchmark = 82;

      const percentORM = service.calculateExercisePercentORM(
        sets,
        benchmark,
        exercise,
      );

      // (30 × 2) / 82 = 60 / 82 = 0.731 = 73.1%
      expect(percentORM).toBeCloseTo(73.1, 1);
    });
  });
});
