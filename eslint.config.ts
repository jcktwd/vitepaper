import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      'node_modules/',
      'content/.vitepress/cache/',
      'content/.vitepress/dist/',
      'content/.vitepress/dist-next/',
      'content/.vitepress/dist-old/',
      'fixture-content/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // TypeScript already reports undefined identifiers, and knows DOM/lib types this rule doesn't
      'no-undef': 'off',
      // Frontmatter and third-party plugin payloads are genuinely untyped
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Components are used directly in Markdown (`<PostList />`, `<Mermaid />`, ...), so short names read best
    files: ['content/.vitepress/theme/**'],
    rules: { 'vue/multi-word-component-names': 'off' },
  }
)
