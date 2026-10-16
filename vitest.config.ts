import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Built-site checks need a build first; they run via `pnpm test:site` (vitest.site.config.ts)
    exclude: [...configDefaults.exclude, 'tests/site/**', 'fixture-content/**'],
  },
})
