import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // Edge functions run on Deno and are checked by the Deno extension, not ESLint.
  globalIgnores(['dist', 'node_modules', 'supabase/functions', '.vult']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [js.configs.recommended, reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', args: 'none', caughtErrors: 'none' }],
      // TanStack Table returns mutable objects, so the React Compiler skips those two components. That is expected.
      'react-hooks/incompatible-library': 'off'
    }
  },
  {
    files: ['*.config.js', 'scripts/**/*.{js,mjs}', 'server/**/*.js'],
    languageOptions: { globals: { ...globals.node } }
  }
]);
