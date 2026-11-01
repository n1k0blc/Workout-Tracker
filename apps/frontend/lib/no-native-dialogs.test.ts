import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * No native `alert()` or `confirm()` anywhere in the frontend (#231): confirmations are an
 * `AlertDialog`, error notices are a toast (`lib/toast.ts`) or a field error. The one native
 * dialog left is the browser's own "Leave site?" prompt in the meal editor (`beforeunload`),
 * which browsers do not let a page restyle and which is not an `alert()` call. A source scan is
 * the only seam that also covers a screen nobody has rendered in a test yet.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const NATIVE_DIALOG = /(?<![\w$.])(?:window\.|globalThis\.)?(?:alert|confirm)\s*\(/;

describe('native dialogs', () => {
  const root = resolve(process.cwd());
  const files = ['app', 'components', 'hooks', 'lib'].flatMap((dir) => sourceFiles(join(root, dir)));

  it('finds the sources to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('recognises the calls it is meant to forbid', () => {
    for (const call of ["alert('x')", "window.alert('x')", 'if (!confirm(t("x")))', "globalThis.confirm ('x')"]) {
      expect(call).toMatch(NATIVE_DIALOG);
    }
    for (const call of ["notify.error('x')", 'setAlert(x)', 'toAlert(x)', 'dialog.confirm(x)']) {
      expect(call).not.toMatch(NATIVE_DIALOG);
    }
  });

  it('call alert() or confirm() nowhere', () => {
    const offenders = files.flatMap((file) =>
      readFileSync(file, 'utf-8')
        .split('\n')
        .flatMap((line, i) => (NATIVE_DIALOG.test(line) ? [`${file.replace(`${root}/`, '')}:${i + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
