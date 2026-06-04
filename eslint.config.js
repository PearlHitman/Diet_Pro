// ESLint flat-config for Mise.
// Run with: npm run lint
//
// Rules of thumb:
//  - TypeScript-aware, but no type-checked rules (keeps it fast).
//  - React Hooks rules are errors — they catch real bugs.
//  - We're lenient on `any` (errors as warn) because Claude SDK + DOM
//    boundary code legitimately needs it; tighten later when we have
//    proper schema validators in front of every external surface.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'build',
      'node_modules',
      'coverage',
      'public',
      '*.config.js',
      '*.config.ts',
      'scripts/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Claude SDK + browser APIs occasionally force `any` at the boundary.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow unused args starting with `_` (common React event handler pattern).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // `void expr` is a valid way to deliberately discard a Promise result.
      'no-void': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Tests sometimes destructure to discard fields; not a real issue.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
