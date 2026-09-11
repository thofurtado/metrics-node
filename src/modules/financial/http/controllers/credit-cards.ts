import { makePayCreditCardInvoiceUseCase } from '@/modules/financial/use-cases/factories/make-pay-credit-card-invoice'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

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

// ─── PAY INVOICE (OPÇÃO B: AMORTIZAÇÃO DIRETA POR COMPRAS E PRESERVAÇÃO DE SETORES) ──
export async function payCreditCardInvoice(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const querySchema = z.object({
        month: z.string().min(1, 'Mês é obrigatório') // Format 'YYYY-MM'
    })
    const bodySchema = z.object({
        amountPaid: z.number().positive('Valor de pagamento deve ser positivo').optional(),
        accountId: z.string().uuid().optional(),
        paymentDate: z.coerce.date().optional(),
        paymentMethod: z.string().optional()
    }).optional()

    const { id } = paramsSchema.parse(request.params)
    const { month } = querySchema.parse(request.query)
    const body = bodySchema.parse(request.body || {})

    try {
        const payUseCase = makePayCreditCardInvoiceUseCase()
        const result = await payUseCase.execute({
            creditCardId: id,
            month,
            amountPaid: body?.amountPaid,
            accountId: body?.accountId,
            paymentDate: body?.paymentDate,
            paymentMethod: body?.paymentMethod
        })

        return reply.status(200).send({
            success: true,
            paidAmount: result.paidAmount,
            remainingAmount: result.remainingAmount,
            isFullyPaid: result.isFullyPaid,
            confirmedCount: result.confirmedCount,
            splitOccurred: result.splitOccurred
        })
    } catch (err: any) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        return reply.status(400).send({ message: err.message || 'Erro ao processar pagamento da fatura.' })
    }
}
