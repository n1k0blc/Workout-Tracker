const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

// Flat-config port of the old .eslintrc.js — same parser, same plugin,
// same rule overrides. ESLint 9+ dropped eslintrc support, so this file
// (not .eslintrc.js, which ESLint 10 no longer reads) is what runs (issue #170).
module.exports = [
  {
    ignores: ['eslint.config.js', 'dist/**', 'coverage/**'],
  },
  ...tsPlugin.configs['flat/recommended'],
  prettierRecommended,
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Matches the codebase's existing convention of naming a deliberately
      // discarded destructured binding with a leading underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
