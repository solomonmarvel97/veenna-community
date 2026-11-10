import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      'build/**',
      'coverage/**',
      '.gitnexus/**',
      'electron/**',
      'scripts/**',
      'playwright-report/**',
      'test-results/**',
      'HomeView-*.js',
      'useDictation-*.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'vue/multi-word-component-names': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Plain scripts served as-is from public/ (e.g. theme-boot.js runs before the app).
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
  },  {
    // The Community API runs on Bun/Node, not in the browser.
    files: ['api/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },  {
    // Keep files small and single-purpose; split a file before raising this.
    files: ['src/**/*.{ts,vue}'],
    ignores: ['**/*.test.ts', 'src/types/electron.d.ts'],
    rules: {
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
)
