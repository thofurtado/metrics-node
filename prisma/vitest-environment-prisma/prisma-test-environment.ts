import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { Environment } from 'vitest/environments'
import { Client } from 'pg'

function generateDatabaseURL(schema: string) {
    if (!process.env.DATABASE_URL) {
        throw new Error('Please provide a DATABASE_URL environment variable.')
    }
    const url = new URL(process.env.DATABASE_URL)
    url.searchParams.set('schema', schema)
    return url.toString()
}

export default <Environment>{
    name: 'prisma',
    transformMode: 'ssr',
    async setup() {
        const schema = randomUUID()
        const databaseURL = generateDatabaseURL(schema)

        process.env.DATABASE_URL = databaseURL

        execSync('npx prisma migrate deploy', { env: process.env })

        return {
            async teardown() {
                const client = new Client({
                    connectionString: databaseURL,
                })

                await client.connect()
                await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
                await client.end()
            },
        }
    },
}
