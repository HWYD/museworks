import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: [
      'apps/desktop/src/main/**/*.{ts,tsx}',
      'apps/desktop/src/preload/**/*.{ts,tsx}',
      'apps/desktop/*.{ts,mts,cts}',
      'apps/desktop/tests/**/*.{ts,tsx}',
      'packages/*/tests/**/*.{ts,tsx}',
      'scripts/**/*.{js,mjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
