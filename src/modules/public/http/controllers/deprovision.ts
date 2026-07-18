import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Pool } from 'pg'
import { env } from '@/env'

export async function deprovisionTenant(request: FastifyRequest, reply: FastifyReply) {
    const deprovisionParamsSchema = z.object({
        dbName: z.string().min(1)
    })

    const { dbName } = deprovisionParamsSchema.parse(request.params)

    // Segurança básica: só o master pode pedir isso (verificação de chave)
    const apiKey = request.headers['x-api-key']
    if (apiKey !== (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')) {
        return reply.status(401).send({ message: 'Acesso não autorizado para desprovisionamento' })
    }

    // 🚨 REGRA DE OURO: NÃO PERMITIR DELETAR BANCOS SENSÍVEIS E DE SISTEMA 🚨
    const protectedDatabases = ['postgres', 'db_master', 'metrics', 'db_eureca', 'template1']
    if (protectedDatabases.includes(dbName.toLowerCase())) {
        console.error(`🚨 Tentativa de exclusão de banco de dados protegido bloqueada: ${dbName}`)
        return reply.status(403).send({ message: 'Ação Bloqueada: Você não tem permissão para deletar este banco de dados sensível.' })
    }

    // Validação básica do dbName para evitar SQL Injection
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
        return reply.status(400).send({ message: 'Nome de banco de dados inválido.' })
    }

    try {
        console.log(`🧨 Iniciando EXCLUSÃO PERMANENTE do banco: ${dbName}`)

        // 1. Conectar no Postgres root (usando a URL master)
        const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"
        const rootUrl = masterUrl.replace(/\/db_[^?]+/, '/postgres')
        const pool = new Pool({ connectionString: rootUrl })

        // 2. Desconectar outros usuários do banco alvo (necessário para conseguir rodar o DROP)
        await pool.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = $1
            AND pid <> pg_backend_pid()
        `, [dbName])

        // 3. Deletar o banco
        await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`)
        await pool.end()

        console.log(`💥 Banco de dados ${dbName} foi destruído com sucesso.`)
        return reply.status(200).send({ message: 'Banco de dados excluído permanentemente.' })

    } catch (error: any) {
        console.error('❌ Erro no desprovisionamento:', error)
        return reply.status(500).send({ message: 'Erro ao deletar banco de dados', details: error.message })
    }
}
