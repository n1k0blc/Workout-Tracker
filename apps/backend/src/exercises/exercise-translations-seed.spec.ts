import {
  parseExerciseTranslationsCsv,
  seedExerciseTranslations,
} from './exercise-translations-seed';

describe('parseExerciseTranslationsCsv', () => {
  it('maps csvId to the English name', () => {
    const map = parseExerciseTranslationsCsv('ID;Exercise\n1;Cable Crunch\n2;Pull-Up\n');
    expect(map.get(1)).toBe('Cable Crunch');
    expect(map.get(2)).toBe('Pull-Up');
  });

  it('rejects a row with an empty name, naming the line', () => {
    expect(() => parseExerciseTranslationsCsv('ID;Exercise\n1;\n')).toThrow(/line 2/);
  });
});

describe('seedExerciseTranslations', () => {
  const rows = [
    { id: 'a', csvId: 1, name: 'Kabel Crunch' },
    { id: 'b', csvId: 2, name: 'Klimmzug' },
  ];
  const makePrisma = (found = rows) => {
    const upsert = jest.fn().mockResolvedValue({});
    const count = jest.fn().mockResolvedValue(found.length);
    const findMany = jest.fn().mockResolvedValue(found);
    return { prisma: { exercise: { findMany }, exerciseTranslation: { upsert, count } }, upsert };
  };

  it('upserts a de and en row for every catalogue exercise', async () => {
    const { prisma, upsert } = makePrisma();
    await seedExerciseTranslations(
      prisma as never,
      new Map([
        [1, 'Cable Crunch'],
        [2, 'Pull-Up'],
      ]),
    );
    expect(upsert).toHaveBeenCalledTimes(4);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { exerciseId_locale: { exerciseId: 'a', locale: 'EN' } },
        create: { exerciseId: 'a', locale: 'EN', name: 'Cable Crunch' },
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { exerciseId: 'b', locale: 'DE', name: 'Klimmzug' },
      }),
    );
  });

  it('aborts, naming the exercise, when a catalogue row has no English name', async () => {
    const { prisma, upsert } = makePrisma();
    await expect(
      seedExerciseTranslations(prisma as never, new Map([[1, 'Cable Crunch']])),
    ).rejects.toThrow(/Klimmzug/);
    expect(upsert).not.toHaveBeenCalled();
  });
});
