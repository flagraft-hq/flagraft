import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'packages/*/dist/',
      'packages/*/node_modules/',
      'public/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Fastify registers async handlers and preHandlers on void-returning slots by design
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false, properties: false } },
      ],
      // Fastify preHandlers must be async by interface even when no await is needed
      '@typescript-eslint/require-await': 'off',
      'no-console': 'warn',
    },
  },
  {
    files: ['src/cli/**', 'scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
]
