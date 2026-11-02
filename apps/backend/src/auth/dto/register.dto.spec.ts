import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/errors/validation-pipe';
import { RegisterDto } from './register.dto';

const valid = {
  email: 'max@example.com',
  password: 'correct horse',
  firstName: 'Max',
  lastName: 'Mustermann',
  dateOfBirth: '1990-01-01',
  height: 180,
  weight: 75,
  homeGyms: [{ name: 'Fit & Fun' }],
};

async function errorsFor(overrides: Record<string, unknown>) {
  const meta: ArgumentMetadata = { type: 'body', metatype: RegisterDto };
  try {
    await createValidationPipe().transform({ ...valid, ...overrides }, meta);
    return [];
  } catch (e) {
    return (
      (e as BadRequestException).getResponse() as {
        errors: { property: string; constraints: string[] }[];
      }
    ).errors;
  }
}

const constraintsOf = async (field: string, value: unknown) =>
  (await errorsFor({ [field]: value })).find((e) => e.property === field)?.constraints;

describe('RegisterDto', () => {
  it('accepts a complete registration', async () => {
    expect(await errorsFor({})).toEqual([]);
  });

  it('applies the person-name rule to first and last name', async () => {
    expect(await constraintsOf('firstName', 'Nguyễn')).toBeUndefined();
    expect(await constraintsOf('lastName', "O'Brien")).toBeUndefined();
    expect(await constraintsOf('firstName', 'Max2')).toEqual(['isPersonName']);
    expect(await constraintsOf('lastName', 'Muster@mann')).toEqual(['isPersonName']);
  });

  it('caps the e-mail at 254 characters', async () => {
    // A syntactically valid address of exactly `n` characters: a 64-character local part (the
    // RFC maximum), three 60-character labels, and a top-level domain that takes up the rest.
    const emailOfLength = (n: number) => {
      const labels = `${'b'.repeat(60)}.${'b'.repeat(60)}.${'b'.repeat(60)}`;
      return `${'a'.repeat(64)}@${labels}.${'c'.repeat(n - 64 - 1 - labels.length - 1)}`;
    };
    expect(emailOfLength(254)).toHaveLength(254);
    expect(await constraintsOf('email', emailOfLength(254))).toBeUndefined();
    expect(await constraintsOf('email', emailOfLength(255))).toContain('maxLength');
  });

  it('keeps the password between 8 and 100 characters', async () => {
    expect(await constraintsOf('password', 'a'.repeat(8))).toBeUndefined();
    expect(await constraintsOf('password', 'a'.repeat(7))).toEqual(['minLength']);
    expect(await constraintsOf('password', 'a'.repeat(100))).toBeUndefined();
    expect(await constraintsOf('password', 'a'.repeat(101))).toEqual(['maxLength']);
  });

  it('keeps the height between 100 and 250 cm', async () => {
    expect(await constraintsOf('height', 100)).toBeUndefined();
    expect(await constraintsOf('height', 99)).toEqual(['min']);
    expect(await constraintsOf('height', 250)).toBeUndefined();
    expect(await constraintsOf('height', 251)).toEqual(['max']);
  });

  it('keeps the body weight between 30 and 400 kg', async () => {
    expect(await constraintsOf('weight', 30)).toBeUndefined();
    expect(await constraintsOf('weight', 29.9)).toEqual(['min']);
    expect(await constraintsOf('weight', 400)).toBeUndefined();
    expect(await constraintsOf('weight', 400.1)).toEqual(['max']);
  });

  it('applies the base text rule to gym names and allows special characters', async () => {
    expect(await errorsFor({ homeGyms: [{ name: 'a'.repeat(100) }] })).toEqual([]);
    expect(await errorsFor({ homeGyms: [{ name: 'a'.repeat(101) }] })).toEqual([
      { property: 'homeGyms.0.name', constraints: ['maxLength'] },
    ]);
    expect(await errorsFor({ homeGyms: [{ name: 'Gym​' }] })).toEqual([
      { property: 'homeGyms.0.name', constraints: ['noControlCharacters'] },
    ]);
  });

  it('allows at most 10 gyms', async () => {
    const gyms = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Gym ${i}` }));
    expect(await errorsFor({ homeGyms: gyms(10) })).toEqual([]);
    expect(await constraintsOf('homeGyms', gyms(11))).toEqual(['arrayMaxSize']);
  });
});
