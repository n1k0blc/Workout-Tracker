import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../errors/validation-pipe';
import { BaseText, MaxAge, MinAge, PersonName } from './field-rules';

class Sample {
  @BaseText(10)
  title: string;
}

class Person {
  @PersonName()
  firstName: string;
}

class Born {
  @MinAge(13)
  @MaxAge(120)
  dateOfBirth: string;
}

/** Sends `body` through the app's real ValidationPipe; returns the transformed DTO or the errors. */
async function run<T>(metatype: new () => T, body: unknown) {
  const meta: ArgumentMetadata = { type: 'body', metatype };
  try {
    return { ok: (await createValidationPipe().transform(body, meta)) as T, errors: [] };
  } catch (e) {
    const response = (e as BadRequestException).getResponse() as {
      errors: { property: string; constraints: string[] }[];
    };
    return { ok: null, errors: response.errors };
  }
}

describe('BaseText', () => {
  it('accepts text exactly at the length cap and rejects one character more', async () => {
    expect((await run(Sample, { title: 'a'.repeat(10) })).errors).toEqual([]);
    expect((await run(Sample, { title: 'a'.repeat(11) })).errors).toEqual([
      { property: 'title', constraints: ['maxLength'] },
    ]);
  });

  it('trims before checking, and stores the trimmed value', async () => {
    const result = await run(Sample, { title: '  Fit & Fun  ' });
    expect(result.errors).toEqual([]);
    expect(result.ok?.title).toBe('Fit & Fun');
    // 10 characters plus surrounding spaces is still within the cap.
    expect((await run(Sample, { title: `  ${'a'.repeat(10)}  ` })).errors).toEqual([]);
  });

  it('rejects empty and whitespace-only text', async () => {
    expect((await run(Sample, { title: '' })).errors[0].constraints).toContain('isNotEmpty');
    expect((await run(Sample, { title: '   ' })).errors[0].constraints).toContain('isNotEmpty');
  });

  it('rejects control and zero-width characters instead of stripping them', async () => {
    for (const bad of ['a\u0000b', 'a\nb', 'a​b', 'a⁠b', 'a﻿b']) {
      expect((await run(Sample, { title: bad })).errors).toEqual([
        { property: 'title', constraints: ['noControlCharacters'] },
      ]);
    }
  });

  it('allows special characters as typed', async () => {
    const result = await run(Sample, { title: "M&M's <7P>" });
    expect(result.errors).toEqual([]);
    expect(result.ok?.title).toBe("M&M's <7P>");
  });

  it('rejects a non-string', async () => {
    expect((await run(Sample, { title: 42 })).errors[0].constraints).toContain('isString');
  });
});

describe('PersonName', () => {
  it.each([
    'Müller',
    'José',
    "O'Brien",
    'O’Brien',
    'Anna-Lena',
    'Nguyễn',
    'Nguyễn'.normalize('NFD'),
    'J. R.',
    'Li',
  ])('accepts %s', async (name) => {
    expect((await run(Person, { firstName: name })).errors).toEqual([]);
  });

  it.each(['Max2', '4711', 'Max@', 'Max_Mustermann', '-Anna', "'Neil", '.x', 'Max<b>'])(
    'rejects %s with isPersonName',
    async (name) => {
      const errors = (await run(Person, { firstName: name })).errors;
      expect(errors[0].constraints).toContain('isPersonName');
    },
  );

  it('is capped at 50 characters', async () => {
    expect((await run(Person, { firstName: 'a'.repeat(50) })).errors).toEqual([]);
    expect((await run(Person, { firstName: 'a'.repeat(51) })).errors[0].constraints).toContain(
      'maxLength',
    );
  });
});

describe('MinAge / MaxAge', () => {
  // "Today" is 2026-06-15 in the server's zone (Europe/Berlin, midday so no zone edge).
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('accepts someone who turns 13 today and rejects someone a day short', async () => {
    expect((await run(Born, { dateOfBirth: '2013-06-15' })).errors).toEqual([]);
    expect((await run(Born, { dateOfBirth: '2013-06-16' })).errors).toEqual([
      { property: 'dateOfBirth', constraints: ['minAge'] },
    ]);
  });

  it('accepts 120 years old, until the 121st birthday, and rejects older', async () => {
    expect((await run(Born, { dateOfBirth: '1905-06-16' })).errors).toEqual([]);
    expect((await run(Born, { dateOfBirth: '1905-06-15' })).errors).toEqual([
      { property: 'dateOfBirth', constraints: ['maxAge'] },
    ]);
  });

  it('rejects a birth date in the future as too young', async () => {
    expect((await run(Born, { dateOfBirth: '2027-01-01' })).errors[0].constraints).toContain(
      'minAge',
    );
  });
});
