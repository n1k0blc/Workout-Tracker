import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Every search box is capped at `SEARCH_MAX` characters and restricted in nothing else (#230):
 * `T-Bar Row`, `7UP` and `M&M's` have to be typeable. A source scan covers a box nobody has
 * rendered in a test; jsdom would not enforce `maxLength` on a programmatic change anyway.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

describe('search boxes', () => {
  const root = resolve(process.cwd());
  const files = ['app', 'components'].flatMap((dir) => sourceFiles(join(root, dir)));
  // The `<Input ... />` element around each search placeholder (an arrow function inside it
  // contains `>`, so the element is cut at its opening tag and its closing `/>`).
  const boxes = files.flatMap((file) => {
    const source = readFileSync(file, 'utf-8');
    return [...source.matchAll(/placeholder=\{t\('searchPlaceholder'\)\}/g)].map((m) => {
      const start = source.lastIndexOf('<Input', m.index);
      const end = source.indexOf('/>', m.index);
      return { file: file.replace(`${root}/`, ''), tag: source.slice(start, end) };
    });
  });

  it('finds the search boxes to check', () => {
    expect(boxes.length).toBeGreaterThanOrEqual(5);
  });

  it('caps each at SEARCH_MAX characters', () => {
    expect(boxes.filter((b) => !b.tag.includes('maxLength={SEARCH_MAX}')).map((b) => b.file)).toEqual([]);
  });

  it('restricts none by pattern', () => {
    expect(boxes.filter((b) => /\bpattern=/.test(b.tag)).map((b) => b.file)).toEqual([]);
  });
});
