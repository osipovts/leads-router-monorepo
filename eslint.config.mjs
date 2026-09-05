import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // Игнорируемые директории
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/prisma/generated/**'],
  },

  // Базовые JS правила
  js.configs.recommended,

  // Общие настройки JS/TS
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      // Node.js globals:
      // process, Buffer, __dirname и т.д.
      globals: globals.node,

      parserOptions: {
        projectService: true,
      },
    },

    plugins: {
      // Автосортировка импортов
      'simple-import-sort': simpleImportSort,
    },

    rules: {
      // Сортирует:
      // 1. node_modules
      // 2. внутренние импорты
      // 3. относительные импорты
      'simple-import-sort/imports': 'error',

      // Сортирует export statements
      'simple-import-sort/exports': 'error',
    },
  },

  // Только TypeScript
  {
    files: ['**/*.{ts,mts,cts}'],

    // Строгие TS правила
    extends: [
      tseslint.configs.strictTypeChecked,

      // Стиль TS
      tseslint.configs.stylisticTypeChecked,
    ],

    languageOptions: {
      parserOptions: {
        // ESLint сам найдет tsconfig; Prisma config находится вне src.
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: ['apps/router/prisma.config.ts'],
        },
      },
    },

    rules: {
      // Использовать:
      // import type { User } from '@/modules/user/domain/user.entity'
      //
      // вместо:
      // import { User } from '@/modules/user/domain/user.entity'
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],

      // string[] вместо Array<string>
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'array-simple',
        },
      ],

      // Запрещает any
      '@typescript-eslint/no-explicit-any': 'error',

      // NestJS modules are intentionally represented by decorated empty classes.
      // Keep reporting other empty classes, which are usually accidental.
      '@typescript-eslint/no-extraneous-class': [
        'error',
        {
          allowWithDecorator: true,
        },
      ],

      // Generic response wrappers use their type parameter to preserve the
      // concrete payload type for controllers and Swagger DTO subclasses.
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',

      // Exception messages are polymorphic accessors inherited from Error.
      '@typescript-eslint/class-literal-property-style': ['error', 'getters'],

      // Неиспользуемые переменные
      //
      // разрешает:
      // const _unused = value
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Promise должен быть обработан
      //
      // плохо:
      // saveUser(user)
      //
      // хорошо:
      // await saveUser(user)
      '@typescript-eslint/no-floating-promises': 'error',

      // Проверка async callback
      '@typescript-eslint/no-misused-promises': 'error',

      // Запрещает небезопасный any flow
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // Запрещает опасные проверки:
      // if (someString)
      //
      // вместо:
      // if (someString !== '')
      '@typescript-eslint/strict-boolean-expressions': 'error',
    },
  },

  // JS файлы не проверяем type-aware правилами TS
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // отключает конфликтующие правила prettier
  prettier,
);
