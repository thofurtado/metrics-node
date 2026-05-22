import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import dotenv from 'dotenv'

// Load test environment variables before anything else
dotenv.config({ path: '.env.test' })

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environmentMatchGlobs: [
            ['src/http/controllers/**', 'prisma']
        ]
    }
})

