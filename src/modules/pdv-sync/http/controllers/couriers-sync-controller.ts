import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    normalizarEntregaAPagar,
    normalizarMotoboy,
    type EntregaAPagarDoPdv,
    type MotoboyDoPdv,
} from '../../services/motoboys-do-pdv'

/**
 * Motoboys e entregas/diárias a pagar do PDV (15/10/2026, plano 2.5). O PDV é a fonte e a web só lê (relatório dos
 * motoboys). Em lote, upsert pelo Uuid do PDV, com a mesma chave das outras rotas /api/pdv/sync/*. Item com defeito não
 * derruba o lote: vai em "Ignorados" com o motivo e o resto é gravado. Responde { Recebidos: n }.
 */

const motoboySchema = z.object({
    Uuid: z.string().uuid(),
    // Nome vazio não derruba o motoboy (o PDV marca o lote como enviado em qualquer 2xx): vira "Motoboy sem nome"
    Nome: z.string().optional().nullable(),
    Telefone: z.string().optional().nullable(),
    FormaGanho: z.string().optional().nullable(),
    ValorPorEntrega: z.number().optional().nullable(),
    Diaria: z.number().optional().nullable(),
    Ativo: z.boolean().optional().nullable(),
    GanhoDesde: z.string().optional().nullable(),
})

const entregaSchema = z.object({
    Uuid: z.string().uuid(),
    MotoboyUuid: z.string().uuid(),
    Tipo: z.string().optional().nullable(),
    PedidoUuid: z.string().optional().nullable(),
    Data: z.string().optional().nullable(),
    Dia: z.string().optional().nullable(),
    Descricao: z.string().optional().nullable(),
    TaxaCobrada: z.number().optional().nullable(),
    ValorAPagar: z.number().optional().nullable(),
    Situacao: z.string().optional().nullable(),
    Motivo: z.string().optional().nullable(),
    AcertoUuid: z.string().optional().nullable(),
    PagoEm: z.string().optional().nullable(),
    FormaPagamento: z.string().optional().nullable(),
})

type Ignorado = { Uuid: string | null; Motivo: string }

function separarItens<T>(corpo: unknown, schema: z.ZodType<T>): { validos: T[]; ignorados: Ignorado[] } | null {
    if (!Array.isArray(corpo)) return null
    const validos: T[] = []
    const ignorados: Ignorado[] = []
    for (const item of corpo) {
        const r = schema.safeParse(item)
        if (r.success) validos.push(r.data)
        else {
            const uuid = item && typeof item === 'object' && typeof (item as any).Uuid === 'string' ? (item as any).Uuid : null
            const problema = r.error.issues[0]
            ignorados.push({ Uuid: uuid, Motivo: `Campo ${problema?.path.join('.') || '?'}: ${problema?.message || 'inválido'}` })
        }
    }
    return { validos, ignorados }
}

export async function postCouriersSync(request: FastifyRequest, reply: FastifyReply) {
    const lote = separarItens<MotoboyDoPdv>(request.body, motoboySchema)
    if (!lote) return reply.status(400).send({ message: 'O corpo precisa ser uma lista de motoboys.' })

    await prisma.$transaction(async (tx) => {
        for (const m of lote.validos) {
            const dados = normalizarMotoboy(m)
            await tx.deliveryCourier.upsert({ where: { id: dados.id }, update: dados, create: dados })
            // Entregas que chegaram antes do motoboy: ligam agora
            await tx.courierPayable.updateMany({ where: { courier_uuid: dados.id, courier_id: null }, data: { courier_id: dados.id } })
        }
    }, { timeout: 30000, maxWait: 10000 })

    return reply.status(200).send({ Recebidos: lote.validos.length, Aceitos: lote.validos.map(m => m.Uuid), Ignorados: lote.ignorados })
}

export async function postCourierPayablesSync(request: FastifyRequest, reply: FastifyReply) {
    const lote = separarItens<EntregaAPagarDoPdv>(request.body, entregaSchema)
    if (!lote) return reply.status(400).send({ message: 'O corpo precisa ser uma lista de entregas a pagar.' })

    const motoboys = new Set((await prisma.deliveryCourier.findMany({
        where: { id: { in: [...new Set(lote.validos.map(e => e.MotoboyUuid))] } },
        select: { id: true },
    })).map(m => m.id))

    await prisma.$transaction(async (tx) => {
        for (const e of lote.validos) {
            // Motoboy que ainda não subiu: guarda o uuid e liga quando ele chegar (postCouriersSync)
            const dados = normalizarEntregaAPagar(e, motoboys.has(e.MotoboyUuid))
            await tx.courierPayable.upsert({ where: { id: dados.id }, update: dados, create: dados })
        }
    }, { timeout: 30000, maxWait: 10000 })

    return reply.status(200).send({ Recebidos: lote.validos.length, Aceitos: lote.validos.map(e => e.Uuid), Ignorados: lote.ignorados })
}
