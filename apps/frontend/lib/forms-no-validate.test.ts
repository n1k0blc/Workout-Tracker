import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Every `<form>` carries `noValidate` (#222): the browser's own validation popup must never
 * appear, because field errors are drawn by the app. A source scan is the only seam that also
 * covers a form nobody has rendered in a test yet.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

describe('forms', () => {
  const root = resolve(process.cwd());
  const files = ['app', 'components'].flatMap((dir) => sourceFiles(join(root, dir)));

  it('finds the forms to check', () => {
    expect(files.filter((f) => /<form[\s>]/.test(readFileSync(f, 'utf-8'))).length).toBeGreaterThan(3);
  });

  it('have noValidate on every <form>', () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf-8');
      return [...source.matchAll(/<form\b[^>]*>/g)]
        .filter(([tag]) => !/\bnoValidate\b/.test(tag))
        .map(() => file.replace(`${root}/`, ''));
    });
    expect(offenders).toEqual([]);
  });
});
