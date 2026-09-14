import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
      'components/**/*.test.tsx',
      'hooks/**/*.test.ts',
      'app/**/*.test.tsx',
    ],
    server: {
      // next-intl's ESM build imports extensionless `next/server` -- Next ships no
      // "exports" map for that subpath, so it resolves fine under Next's own bundler
      // (and under plain Node's legacy filesystem fallback) but not when Vitest
      // externalizes it straight to Node's strict ESM loader. Inlining routes it
      // through Vite's own resolver instead, which handles it like Next does.
      deps: {
        inline: ['next-intl'],
      },
    },
  },
});
