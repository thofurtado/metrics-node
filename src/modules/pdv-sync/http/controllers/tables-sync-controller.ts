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
        itens: z.array(z.object({
            id: z.string().optional(),
            produto_id: z.string().optional().nullable(),
            produto_nome: z.string(),
            quantidade: z.number().default(1),
            valor_unitario: z.number().default(0),
            valor_total: z.number().default(0),
            complementos_json: z.string().optional().nullable(),
            observacao: z.string().optional().nullable(),
        })).optional().default([])
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

    // Persistência resiliente de snapshot em banco de dados
    try {
        for (const t of tables) {
            if (t.status !== 'Livre') {
                const activeT = await (prisma as any).activeTable.upsert({
                    where: { identifier: t.identificador },
                    update: {
                        type: t.tipo,
                        status: t.status,
                        people_count: t.quantidade_pessoas,
                        total_amount: t.total_acumulado,
                        opened_at: t.aberta_em ? new Date(t.aberta_em) : new Date()
                    },
                    create: {
                        identifier: t.identificador,
                        type: t.tipo,
                        status: t.status,
                        people_count: t.quantidade_pessoas,
                        total_amount: t.total_acumulado,
                        opened_at: t.aberta_em ? new Date(t.aberta_em) : new Date()
                    }
                })

                if (t.itens && t.itens.length > 0) {
                    await (prisma as any).activeTableItem.deleteMany({
                        where: { active_table_id: activeT.id }
                    })
                    for (const it of t.itens) {
                        await (prisma as any).activeTableItem.create({
                            data: {
                                active_table_id: activeT.id,
                                product_id: it.produto_id || null,
                                product_name: it.produto_nome,
                                quantity: it.quantidade,
                                unit_price: it.valor_unitario,
                                total_price: it.valor_total,
                                complements_json: it.complementos_json,
                                observation: it.observacao
                            }
                        })
                    }
                }
            } else {
                await (prisma as any).activeTable.deleteMany({
                    where: { identifier: t.identificador }
                })
            }
        }
    } catch (tableErr) {
        console.error('[Sync] Falha ao persistir snapshot de mesas ativas:', tableErr)
    }

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
