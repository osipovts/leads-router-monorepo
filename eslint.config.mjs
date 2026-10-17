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

  // Базовые правила JavaScript
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

      // Сортировка экспортов
      'simple-import-sort/exports': 'error',
    },
  },

  // Только TypeScript
  {
    files: ['**/*.{ts,mts,cts}'],

    // Строгие правила TypeScript
    extends: [
      tseslint.configs.strictTypeChecked,

      // Стиль TS
      tseslint.configs.stylisticTypeChecked,
    ],

    languageOptions: {
      parserOptions: {
        // ESLint находит tsconfig автоматически; конфигурация Prisma проверяется отдельно.
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

      // Проверка асинхронных обработчиков
      '@typescript-eslint/no-misused-promises': 'error',

      // Запрещает использование значений any без проверки типа
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // Неявные проверки строк и чисел запрещены:
      // if (someString)
      //
      // Используйте:
      // if (someString !== '')
      '@typescript-eslint/strict-boolean-expressions': 'error',
    },
  },

  // Для JavaScript отключены правила TypeScript, требующие информации о типах
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // отключает конфликтующие правила prettier
  prettier,
);
