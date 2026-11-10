import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.ts'],
      exclude: ['**/node_modules/**'],
      testTimeout: 20_000,
      hookTimeout: 20_000,
    },
  }),
)
