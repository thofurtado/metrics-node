import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// ─── LIST ───────────────────────────────────────────────────────────────────
export async function listCreditCards(request: FastifyRequest, reply: FastifyReply) {
    const cards = await prisma.creditCard.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        include: { account: true }
    })
    return reply.status(200).send({ creditCards: cards })
}

// ─── CREATE ──────────────────────────────────────────────────────────────────
export async function createCreditCard(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        name: z.string().min(1, 'Nome é obrigatório'),
        bank: z.string().min(1, 'Banco é obrigatório'),
        credit_limit: z.number().positive('Limite deve ser positivo'),
        closing_day: z.number().int().min(1).max(31),
        due_day: z.number().int().min(1).max(31),
        last_four_digits: z.string().length(4).optional().nullable(),
        color: z.string().optional().nullable(),
        account_id: z.string().uuid().optional().nullable()
    })

    const data = bodySchema.parse(request.body)

    const card = await prisma.creditCard.create({ data })
    return reply.status(201).send(card)
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
export async function updateCreditCard(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const bodySchema = z.object({
        name: z.string().min(1).optional(),
        bank: z.string().min(1).optional(),
        credit_limit: z.number().positive().optional(),
        closing_day: z.number().int().min(1).max(31).optional(),
        due_day: z.number().int().min(1).max(31).optional(),
        last_four_digits: z.string().length(4).optional().nullable(),
        color: z.string().optional().nullable(),
        active: z.boolean().optional(),
        account_id: z.string().uuid().optional().nullable()
    })

    const { id } = paramsSchema.parse(request.params)
    const data = bodySchema.parse(request.body)

    const card = await prisma.creditCard.update({ where: { id }, data })
    return reply.status(200).send(card)
}

// ─── DELETE (soft-delete via active = false) ─────────────────────────────────
export async function deleteCreditCard(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)

    await prisma.creditCard.update({
        where: { id },
        data: { active: false }
    })
    return reply.status(204).send()
}

// ─── PAY INVOICE (BAIXA COLETIVA) ────────────────────────────────────────────
export async function payCreditCardInvoice(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const querySchema = z.object({
        month: z.string().min(1, 'Mês é obrigatório') // Format 'YYYY-MM'
    })

    const { id } = paramsSchema.parse(request.params)
    const { month } = querySchema.parse(request.query)

    const [year, m] = month.split('-').map(Number)
    const startDate = new Date(year, m - 1, 1, 0, 0, 0, 0)
    const endDate = new Date(year, m, 0, 23, 59, 59, 999)

    // Query for all transactions of this credit card due in that month
    const updated = await prisma.transaction.updateMany({
        where: {
            credit_card_id: id,
            data_vencimento: {
                gte: startDate,
                lte: endDate
            }
        },
        data: {
            confirmed: true
        }
    })

    return reply.status(200).send({ count: updated.count })
}
