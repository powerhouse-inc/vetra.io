import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

/**
 * Standalone unit-test config used for hooks and component logic.
 * Separate from `vitest.config.ts` (which loads the Storybook addon and
 * pulls in next.js modules that aren't available at config-load time).
 */
export default defineConfig({
  resolve: {
    alias: [
      // next/font only runs inside the Next compiler; unit tests get a stub.
      {
        find: /^next\/font\/google$/,
        replacement: path.join(dirname, 'test-stubs/next-font-google.ts'),
      },
      // Map @/shared/* before @/* so the more specific alias wins
      { find: /^@\/shared\/(.*)$/, replacement: path.join(dirname, 'modules/shared/$1') },
      { find: /^@\/(.*)$/, replacement: path.join(dirname, '$1') },
    ],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['modules/**/__tests__/**/*.test.{ts,tsx}', 'app/**/__tests__/**/*.test.{ts,tsx}'],
  },
})
