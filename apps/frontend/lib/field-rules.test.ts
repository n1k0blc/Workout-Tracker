import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as rules from './field-rules';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';
import {
  checkBaseText,
  checkBirthDate,
  checkDecimal,
  checkEmail,
  checkInteger,
  checkPassword,
  checkPersonName,
} from './field-rules';

describe('checkBaseText', () => {
  it('passes at the cap and fails one character over', () => {
    expect(checkBaseText('a'.repeat(10), 10)).toBeNull();
    expect(checkBaseText('a'.repeat(11), 10)).toBe('maxLength');
  });

  it('judges the trimmed value, like the server', () => {
    expect(checkBaseText(`  ${'a'.repeat(10)}  `, 10)).toBeNull();
    expect(checkBaseText('   ', 10)).toBe('isNotEmpty');
    expect(checkBaseText('', 10)).toBe('isNotEmpty');
  });

  it('rejects control and zero-width characters', () => {
    for (const bad of ['a\u0000b', 'a\nb', 'a​b', 'a⁠b', 'a﻿b']) {
      expect(checkBaseText(bad, 10)).toBe('noControlCharacters');
    }
  });

  it('allows special characters', () => {
    expect(checkBaseText("Fit & Fun <7P>", 20)).toBeNull();
  });
});

describe('checkPersonName', () => {
  it.each(['Müller', 'José', "O'Brien", 'O’Brien', 'Anna-Lena', 'Nguyễn', 'Nguyễn'.normalize('NFD'), 'J. R.'])(
    'accepts %s',
    (name) => expect(checkPersonName(name)).toBeNull(),
  );

  it.each(['Max2', '4711', 'Max@', 'Max_Mustermann', '-Anna', "'Neil", '.x'])(
    'rejects %s',
    (name) => expect(checkPersonName(name)).toBe('isPersonName'),
  );

  it('is capped at 50 characters and required', () => {
    expect(checkPersonName('a'.repeat(50))).toBeNull();
    expect(checkPersonName('a'.repeat(51))).toBe('maxLength');
    expect(checkPersonName('')).toBe('isNotEmpty');
  });
});

describe('checkEmail', () => {
  it('requires a plausible address of at most 254 characters', () => {
    expect(checkEmail('max@example.com')).toBeNull();
    expect(checkEmail('')).toBe('isNotEmpty');
    expect(checkEmail('max@')).toBe('isEmail');
    expect(checkEmail('max example@x.de')).toBe('isEmail');
    const long = (n: number) => `${'a'.repeat(n - '@example.com'.length)}@example.com`;
    expect(checkEmail(long(254))).toBeNull();
    expect(checkEmail(long(255))).toBe('maxLength');
  });
});

describe('checkPassword', () => {
  it('keeps the length between 8 and 100, without trimming', () => {
    expect(checkPassword('')).toBe('isNotEmpty');
    expect(checkPassword('a'.repeat(7))).toBe('minLength');
    expect(checkPassword('a'.repeat(8))).toBeNull();
    expect(checkPassword('a'.repeat(100))).toBeNull();
    expect(checkPassword('a'.repeat(101))).toBe('maxLength');
    expect(checkPassword('       a')).toBeNull();
  });
});

describe('checkBirthDate', () => {
  const today = '2026-06-15';

  it('accepts exactly 13 years, rejects a day short and the future', () => {
    expect(checkBirthDate('2013-06-15', today)).toBeNull();
    expect(checkBirthDate('2013-06-16', today)).toBe('minAge');
    expect(checkBirthDate('2027-01-01', today)).toBe('minAge');
  });

  it('accepts 120 years old and rejects the 121st birthday', () => {
    expect(checkBirthDate('1905-06-16', today)).toBeNull();
    expect(checkBirthDate('1905-06-15', today)).toBe('maxAge');
  });

  it('requires a date', () => {
    expect(checkBirthDate(null, today)).toBe('isNotEmpty');
  });
});

describe('checkInteger / checkDecimal', () => {
  it('checks a whole number against its range', () => {
    expect(checkInteger('', 100, 250)).toBe('isNotEmpty');
    expect(checkInteger('180.5', 100, 250)).toBe('isInt');
    expect(checkInteger('99', 100, 250)).toBe('min');
    expect(checkInteger('100', 100, 250)).toBeNull();
    expect(checkInteger('250', 100, 250)).toBeNull();
    expect(checkInteger('251', 100, 250)).toBe('max');
  });

  it('checks a decimal against its range and the decimals as typed', () => {
    expect(checkDecimal('', 30, 400, 1)).toBe('isNotEmpty');
    expect(checkDecimal('29.9', 30, 400, 1)).toBe('min');
    expect(checkDecimal('30', 30, 400, 1)).toBeNull();
    expect(checkDecimal('400', 30, 400, 1)).toBeNull();
    expect(checkDecimal('400.1', 30, 400, 1)).toBe('max');
    expect(checkDecimal('75.55', 30, 400, 1)).toBe('maxDecimals');
    expect(checkDecimal('75.5', 30, 400, 1)).toBeNull();
  });
});

/**
 * The backend rules file is the authority and the frontend mirrors it. It is read as text rather
 * than imported for the same reason as the error-code test in useApiErrorMessage.test.tsx: the
 * frontend's Docker image holds only apps/frontend, so an import across the app boundary would
 * break the image build. This test only runs where the backend exists.
 */
describe('drift against the backend field rules', () => {
  const backend = readFileSync(
    resolve(process.cwd(), '../backend/src/common/validation/field-rules.ts'),
    'utf-8',
  );
  // A limit may carry a decimal (`AMOUNT_MIN = 0.1`) and digits in its name (`KCAL_PER_100_MAX`).
  // A trailing `// server-only` exempts a limit the client has no use for: the column maximum of
  // Rest and tracked durations, which are never shown to the user as an error.
  const limitLines = [
    ...backend.matchAll(/^export const ([A-Z0-9_]+) = (\d+(?:\.\d+)?);( \/\/ server-only)?$/gm),
  ];
  const limits = limitLines.filter((m) => !m[3]).map((m) => [m[1], Number(m[2])] as const);
  const serverOnly = limitLines.filter((m) => m[3]).map((m) => m[1]);
  const patterns = [...backend.matchAll(/^export const ([A-Z0-9_]+_PATTERN) = (\/.+\/[a-z]*);$/gm)].map(
    (m) => [m[1], m[2]] as const,
  );
  const frontend = rules as unknown as Record<string, unknown>;

  it('finds the backend limits and patterns to compare', () => {
    expect(limits.length).toBeGreaterThan(5);
    expect(patterns.length).toBeGreaterThanOrEqual(2);
  });

  it.each(limits)('limit %s is the same on both sides', (name, value) => {
    expect(frontend[name]).toBe(value);
  });

  it.each(patterns)('pattern %s is the same on both sides', (name, literal) => {
    expect(String(frontend[name])).toBe(literal);
  });

  it('does not define a limit the backend marks server-only', () => {
    expect(serverOnly).toContain('INT_COLUMN_MAX');
    for (const name of serverOnly) expect(name in rules).toBe(false);
  });

  it('has no numeric limit the backend does not know', () => {
    const known = new Set(limits.map(([name]) => name));
    const extra = Object.entries(frontend)
      .filter(([name, v]) => typeof v === 'number' && /^[A-Z0-9_]+$/.test(name) && !known.has(name))
      .map(([name]) => name);
    expect(extra).toEqual([]);
  });

  it('has a de and en catalogue entry for every constraint the backend rules can report', () => {
    const names = new Set(
      [
        ...backend.matchAll(/(?:constraint|ageRule)\(\s*'([A-Za-z]+)'/g),
        ...backend.matchAll(/name: '([A-Za-z]+)',\s*target/g),
      ].map((m) => m[1]),
    );
    expect(names.size).toBeGreaterThan(8);
    for (const [locale, messages] of [['de', deMessages], ['en', enMessages]] as const) {
      const validation = messages.ApiErrors.validation as Record<string, unknown>;
      for (const name of names) {
        // A generic entry, or one under the field it belongs to (`dateOfBirth.minAge`).
        const found =
          typeof validation[name] === 'string' ||
          Object.values(validation).some(
            (v) => typeof v === 'object' && v !== null && name in (v as object),
          );
        expect(found, `${name} (${locale})`).toBe(true);
      }
    }
  });
});
