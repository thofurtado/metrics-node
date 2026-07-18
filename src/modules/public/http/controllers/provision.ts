import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Pool } from 'pg'
import { execSync } from 'child_process'
import { env } from '@/env'

export async function provisionTenant(request: FastifyRequest, reply: FastifyReply) {
    const provisionBodySchema = z.object({
        dbName: z.string().min(1),
        adminPassword: z.string().default('T0p1nf0r')
    })

    const { dbName } = provisionBodySchema.parse(request.body)

    // Segurança básica: só o master pode pedir isso (verificação de chave)
    const apiKey = request.headers['x-api-key']
    if (apiKey !== (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')) {
        return reply.status(401).send({ message: 'Acesso não autorizado para provisionamento' })
    }

    // Validação básica do dbName para evitar SQL Injection
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
        return reply.status(400).send({ message: 'Nome de banco de dados inválido. Use apenas letras, números e underscores.' })
    }

    try {
        console.log(`🚀 Iniciando provisionamento automático para o banco: ${dbName}`)

        // 1. Conectar no Postgres root (usando a URL master)
        const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
        // Trocamos o nome do banco final para 'postgres' para rodar o comando CREATE DATABASE
        const rootUrl = masterUrl.replace(/\/db_[^?]+/, '/postgres')
        const pool = new Pool({ connectionString: rootUrl })

        // 2. Verificar se o banco já existe
        const dbExists = await pool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName])
        if (dbExists.rows.length === 0) {
            console.log(`📦 Criando banco de dados ${dbName}...`)
            await pool.query(`CREATE DATABASE "${dbName}"`)
        } else {
            console.log(`⚠️ Banco de dados ${dbName} já existe, ignorando criação.`)
        }
        await pool.end()

        // 3. Montar a URL do novo banco
        const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432"
        const newDbUrl = `${baseUrl}/${dbName}?schema=public`

        // 4. Rodar as migrações (Push) e o Seed!
        console.log(`🏗️ Construindo schema do Prisma no novo banco...`)
        
        // Passar a variável de ambiente para que o Prisma conecte no banco certo
        execSync(`npx prisma db push --accept-data-loss`, { 
            env: { ...process.env, DATABASE_URL: newDbUrl },
            stdio: 'inherit' // Permite ver os logs do prisma no console do servidor
        })

        console.log(`🌱 Populando módulos e usuário admin padrão no novo banco...`)
        execSync(`npx prisma db seed`, { 
            env: { ...process.env, DATABASE_URL: newDbUrl },
            stdio: 'inherit'
        })

        console.log(`✅ Provisionamento do banco ${dbName} concluído com sucesso!`)
        return reply.status(200).send({ message: 'Banco de dados criado e populado com sucesso!' })

    } catch (error: any) {
        console.error('❌ Erro no provisionamento:', error)
        return reply.status(500).send({ message: 'Erro ao provisionar banco de dados', details: error.message })
    }
}
