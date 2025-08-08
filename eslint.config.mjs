import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: ['.vite/**', 'node_modules/**'] },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { prettier },
    extends: [js.configs.recommended],
    rules: { 'prettier/prettier': 'error' },
    languageOptions: { globals: globals.node },
  },
  { files: ['**/*.js'], languageOptions: { sourceType: 'module' } },
]);
