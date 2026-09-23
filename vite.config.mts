import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import dotenv from 'dotenv'

// Mesmo fuso do servidor em produção (ver src/server.ts): garante que os testes rodem com o
// mesmo "hoje"/"0h" de Brasília, não o fuso da máquina/CI que estiver rodando os testes.
process.env.TZ = 'America/Sao_Paulo'

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
