import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Armazenamento em memória / cache de telemetria de salão por tenant
const tablesTelemetryCache = new Map<string, any>()

/**
 * Sincroniza o snapshot do mapa de mesas e comandas abertas no salão
 */
export async function postTablesSync(request: FastifyRequest, reply: FastifyReply) {
    const tableSchema = z.array(z.object({
        identificador: z.string(),
        tipo: z.string().default('MESA'),
        status: z.string(), // "Ocupada", "Ociosa", "Livre"
        quantidade_pessoas: z.number().default(1),
        total_acumulado: z.number().default(0),
        quantidade_itens: z.number().default(0),
        tempo_minutos: z.number().default(0),
        aberta_em: z.string().optional(),
    }))

    const tables = tableSchema.parse(request.body)
    const tenant = (request.headers['x-tenant-domain'] as string) || 'default'

    tablesTelemetryCache.set(tenant, {
        updated_at: new Date(),
        total_mesas_ocupadas: tables.filter(t => t.status === 'Ocupada').length,
        total_mesas_pedindo_conta: tables.filter(t => t.status === 'Ociosa').length,
        total_pessoas_salao: tables.reduce((acc, t) => acc + (t.quantidade_pessoas || 0), 0),
        faturamento_em_aberto: tables.reduce((acc, t) => acc + (t.total_acumulado || 0), 0),
        tables
    })

    return reply.status(200).send({
        message: 'Telemetria de mesas sincronizada com sucesso',
        total_recebido: tables.length,
        timestamp: new Date()
    })
}

/**
 * Consulta a telemetria de salão em tempo real para o app do gestor (metrics-mobile / Web)
 */
export async function getTablesTelemetry(request: FastifyRequest, reply: FastifyReply) {
    const tenant = (request.headers['x-tenant-domain'] as string) || 'default'
    const telemetry = tablesTelemetryCache.get(tenant) || {
        updated_at: new Date(),
        total_mesas_ocupadas: 0,
        total_mesas_pedindo_conta: 0,
        total_pessoas_salao: 0,
        faturamento_em_aberto: 0,
        tables: []
    }

    return reply.status(200).send(telemetry)
}
