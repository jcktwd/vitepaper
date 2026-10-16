import { defineConfig } from 'vitest/config'

/** Built-site checks: run after `scripts/build-fixture-site.ts` via `pnpm test:site` */
export default defineConfig({
  test: {
    include: ['tests/site/**/*.test.ts'],
  },
})
