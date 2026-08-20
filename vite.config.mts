import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        fileParallelism: false,
        testTimeout: 25000,
        exclude: ['**/node_modules/**', '**/build/**', '**/dist/**', '**/system-logic.spec.ts'],
        environmentMatchGlobs: [
            ['src/http/controllers/**', 'prisma']
        ]
    }
})
