const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

// Flat-config port of the old .eslintrc.js — same plugin, same rule
// overrides. ESLint 9+ dropped eslintrc support, so this file (not
// .eslintrc.js, which ESLint 10 no longer reads) is what runs (issue #170).
//
// No parserOptions.project here: flat/recommended's own base config already
// sets the parser, and none of its rules are type-aware (that needs
// recommended-type-checked instead), so pointing the parser at tsconfig.json
// would only add a full type-checked parse for every lint run with no rule
// actually using it.
module.exports = [
  {
    ignores: ['eslint.config.js', 'dist/**', 'coverage/**'],
  },
  ...tsPlugin.configs['flat/recommended'],
  prettierRecommended,
  {
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
