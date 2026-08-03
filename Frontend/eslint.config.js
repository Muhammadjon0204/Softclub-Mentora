import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'public/mockServiceWorker.js', 'src/api/generated'],
  },
  {
    // Node-скрипты сборки.
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],

      // Токены и профиль не должны попадать в браузерное хранилище ни при каких условиях.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Auth-данные нельзя хранить в localStorage.' },
        { name: 'sessionStorage', message: 'Auth-данные нельзя хранить в sessionStorage.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Auth-данные нельзя хранить в localStorage.' },
        { object: 'window', property: 'sessionStorage', message: 'Auth-данные нельзя хранить в sessionStorage.' },
      ],
    },
  },
  {
    // Тестам storage нужен — именно чтобы доказать, что там пусто.
    // Fast refresh к тестовым модулям неприменим.
    files: ['src/test/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
);
