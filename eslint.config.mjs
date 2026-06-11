// @ts-check

import eslint from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import storybook from 'eslint-plugin-storybook'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  ...nextVitals,
  ...nextTs,
  ...storybook.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['tests/*', '.storybook/*'],
        },
      },
    },
  },
  globalIgnores([
    'eslint.config.mjs',
    '.storybook/ensure-next-config-shim.cjs',
    'playwright.config.ts',
    'postcss.config.mjs',
    'tailwind.config.js',
    'modules/__generated__/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  prettier,
  {
    // Kysely migrations are schema-version-agnostic and take `Kysely<any>` by
    // design (the typed `DB` describes only the current schema).
    files: ['migrations/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // eslint-config-next only registers the react-hooks plugin for these
    // extensions (no .cjs), so scope its rules to the same set
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    rules: {
      'prefer-const': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false,
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
    },
  },
)
