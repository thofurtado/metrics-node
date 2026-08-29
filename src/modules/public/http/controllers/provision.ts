import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Pool } from 'pg'
import { execSync } from 'child_process'
import { env } from '@/env'
import { getSchemaHash } from './db-status'
import { runTenantOnboarding } from '../services/tenant-onboarding'

export async function provisionTenant(request: FastifyRequest, reply: FastifyReply) {
    const provisionBodySchema = z.object({
        dbName: z.string().min(1),
        adminPassword: z.string().default('T0p1nf0r'),
        masterUser: z.object({
            name: z.string().min(1),
            email: z.string().email(),
            password: z.string().min(4)
        }).optional(),
        enabledModules: z.array(z.string()).optional(),
        systemConfig: z.object({
            merchandise_module: z.boolean().optional(),
            financial_module: z.boolean().optional(),
            treatments_module: z.boolean().optional(),
            cashier_module: z.boolean().optional(),
            hr_module: z.boolean().optional(),
            financial_management_profile: z.string().optional(),
            blind_cashier_closure: z.boolean().optional()
        }).optional()
    })

    const body = provisionBodySchema.parse(request.body)
    const { dbName } = body

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
        console.log(`?? Iniciando provisionamento automático para o banco: ${dbName}`)

        // 1. Conectar no Postgres root (usando a URL master)
        const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
        const rootUrl = masterUrl.replace(/\/db_[^?]+/, '/postgres')
        const pool = new Pool({ connectionString: rootUrl })

        // 2. Verificar se o banco já existe
        const dbExists = await pool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName])
        if (dbExists.rows.length === 0) {
            console.log(`?? Criando banco de dados ${dbName}...`)
            await pool.query(`CREATE DATABASE "${dbName}"`)
        } else {
            console.log(`?? Banco de dados ${dbName} já existe, ignorando criação.`)
        }
        await pool.end()

        // 3. Montar a URL do novo banco
        const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432"
        const newDbUrl = `${baseUrl}/${dbName}?schema=public`

        // 4. Rodar as migrações (Push) e o Seed base
        console.log(`??? Construindo schema do Prisma no novo banco...`)
        const migrateResult = execSync(`npx prisma migrate deploy`, { 
            env: { ...process.env, DATABASE_URL: newDbUrl },
            encoding: 'utf-8'
        })
        console.log(migrateResult)

        console.log(`?? Populando módulos e usuário admin padrão no novo banco...`)
        execSync(`npx prisma db seed`, { 
            env: { ...process.env, DATABASE_URL: newDbUrl },
            stdio: 'inherit'
        })

        // 5. Executar Onboarding Dinâmico (Usuário Master, Módulos selecionados, Contas, Pagamentos)
        await runTenantOnboarding(newDbUrl, {
            adminPassword: body.adminPassword,
            masterUser: body.masterUser,
            enabledModules: body.enabledModules,
            systemConfig: body.systemConfig
        })

        // 6. Atualizar informações de schemaVersion no db_master
        try {
            const currentHash = getSchemaHash()
            const pool2 = new Pool({ connectionString: masterUrl })
            await pool2.query('UPDATE "Tenant" SET "schemaVersion" = $1, "dbSyncedAt" = NOW() WHERE "dbName" = $2', [currentHash, dbName])
            await pool2.end()
            console.log(`Metadata do banco ${dbName} atualizado no db_master.`)
        } catch (dbErr: any) {
            console.error('Erro ao atualizar metadata no db_master:', dbErr)
        }

        console.log(`? Provisionamento e Onboarding do banco ${dbName} concluído com sucesso!`)
        return reply.status(200).send({ 
            message: 'Banco de dados criado, migrado e configurado com sucesso!',
            masterUserEmail: body.masterUser?.email || 'admin@admin.com'
        })

    } catch (error: any) {
        console.error('? Erro no provisionamento:', error)
        return reply.status(500).send({ message: 'Erro ao provisionar banco de dados', details: error.message })
    }
}
