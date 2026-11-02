import 'reflect-metadata';
import { CreateHomeGymDto } from './create-home-gym.dto';
import { UpdateHomeGymDto } from './update-home-gym.dto';
import { UpdateUserDto } from './update-user.dto';
import { constraintsOf, throughPipe } from '../../common/testing/through-pipe';

describe('Gym name', () => {
  it.each([
    ['CreateHomeGymDto', CreateHomeGymDto],
    ['UpdateHomeGymDto', UpdateHomeGymDto],
  ])('is 1-100 characters and allows special characters in %s', async (_n, dto) => {
    const run = (name: string) => throughPipe(dto as never, { name });
    expect((await run('Fit & Fun')).errors).toEqual([]);
    expect((await run('a'.repeat(100))).errors).toEqual([]);
    expect(constraintsOf((await run('a'.repeat(101))).errors, 'name')).toEqual(['maxLength']);
    expect(constraintsOf((await run('')).errors, 'name')).toContain('isNotEmpty');
    expect(constraintsOf((await run('Gym\tOne')).errors, 'name')).toEqual(['noControlCharacters']);
    expect((await run('  Fit & Fun ')).ok).toMatchObject({ name: 'Fit & Fun' });
  });
});

describe('Profil update', () => {
  const run = (body: Record<string, unknown>) => throughPipe(UpdateUserDto, body);

  it('applies the Personenname rule to Vorname and Nachname', async () => {
    for (const field of ['firstName', 'lastName']) {
      expect((await run({ [field]: "Nguyễn O'Brien-Müller" })).errors).toEqual([]);
      expect(constraintsOf((await run({ [field]: 'Max2' })).errors, field)).toEqual([
        'isPersonName',
      ]);
      expect(constraintsOf((await run({ [field]: 'a'.repeat(51) })).errors, field)).toEqual([
        'maxLength',
      ]);
    }
  });

  it('keeps Groesse to 100-250 cm and Koerpergewicht to 30-400 kg', async () => {
    expect((await run({ height: 100, weight: 30 })).errors).toEqual([]);
    expect((await run({ height: 250, weight: 400 })).errors).toEqual([]);
    expect((await run({ height: 99, weight: 29.9 })).errors.map((e) => e.property)).toEqual([
      'height',
      'weight',
    ]);
    expect((await run({ height: 251, weight: 400.1 })).errors.map((e) => e.property)).toEqual([
      'height',
      'weight',
    ]);
  });

  it('checks the birth date for an age of 13 to 120', async () => {
    const yearsAgo = (years: number, extraDays = 0) => {
      const d = new Date();
      d.setUTCFullYear(d.getUTCFullYear() - years);
      d.setUTCDate(d.getUTCDate() + extraDays);
      return d.toISOString().slice(0, 10);
    };
    expect((await run({ dateOfBirth: yearsAgo(13) })).errors).toEqual([]);
    expect(
      constraintsOf((await run({ dateOfBirth: yearsAgo(13, 2) })).errors, 'dateOfBirth'),
    ).toEqual(['minAge']);
    expect(
      constraintsOf((await run({ dateOfBirth: yearsAgo(121, -2) })).errors, 'dateOfBirth'),
    ).toEqual(['maxAge']);
  });

  it('limits Tagesziele: kcal 500-10000, macros 1-1000, or null to clear', async () => {
    expect(
      (await run({ targetKcal: 500, targetCarbs: 1, targetProtein: 1, targetFat: 1 })).errors,
    ).toEqual([]);
    expect(
      (await run({ targetKcal: 10000, targetCarbs: 1000, targetProtein: 1000, targetFat: 1000 }))
        .errors,
    ).toEqual([]);
    expect((await run({ targetKcal: null, targetFat: null })).errors).toEqual([]);

    expect((await run({ targetKcal: 499 })).errors.map((e) => e.property)).toEqual(['targetKcal']);
    expect((await run({ targetKcal: 10001 })).errors.map((e) => e.property)).toEqual([
      'targetKcal',
    ]);
    for (const macro of ['targetCarbs', 'targetProtein', 'targetFat']) {
      expect((await run({ [macro]: 0 })).errors.map((e) => e.property)).toEqual([macro]);
      expect((await run({ [macro]: 1001 })).errors.map((e) => e.property)).toEqual([macro]);
    }
  });
});
