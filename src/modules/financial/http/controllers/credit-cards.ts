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

// ─── PAY INVOICE (BAIXA REAL COM CONCILIAÇÃO E PARCIAL) ─────────────────────────
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

    const card = await prisma.creditCard.findUnique({
        where: { id },
        include: { account: true }
    })

    if (!card) {
        return reply.status(404).send({ message: 'Cartão de crédito não encontrado' })
    }

    const [year, m] = month.split('-').map(Number)
    const startDate = new Date(year, m - 1, 1, 0, 0, 0, 0)
    const endDate = new Date(year, m, 0, 23, 59, 59, 999)

    // 1. Buscar todas as compras desse cartão no mês
    const swipes = await prisma.transaction.findMany({
        where: {
            credit_card_id: id,
            payment_method: 'CREDIT_CARD',
            data_vencimento: {
                gte: startDate,
                lte: endDate
            }
        },
        orderBy: { data_vencimento: 'asc' }
    })

    if (swipes.length === 0) {
        return reply.status(400).send({ message: 'Nenhuma compra encontrada para este cartão no mês informado' })
    }

    const totalSwipes = swipes.reduce((acc, s) => acc + (s.totalValue ?? s.amount), 0)

    // 2. Buscar pagamentos já realizados para a fatura desse mês
    const existingPayments = await prisma.transaction.findMany({
        where: {
            credit_card_id: id,
            operation: 'expense',
            confirmed: true,
            payment_method: { not: 'CREDIT_CARD' },
            data_vencimento: {
                gte: startDate,
                lte: endDate
            }
        }
    })

    const alreadyPaid = existingPayments.reduce((acc, p) => acc + (p.totalValue ?? p.amount), 0)
    const remainingBalance = Number(Math.max(0, totalSwipes - alreadyPaid).toFixed(2))

    if (remainingBalance <= 0.01) {
        return reply.status(400).send({ message: 'Esta fatura já se encontra totalmente quitada.' })
    }

    const targetAmountPaid = Number((body?.amountPaid ?? remainingBalance).toFixed(2))

    if (targetAmountPaid <= 0.01) {
        return reply.status(400).send({ message: 'O valor pago deve ser maior que zero.' })
    }

    if (targetAmountPaid > remainingBalance + 0.01) {
        return reply.status(400).send({
            message: `O valor informado (R$ ${targetAmountPaid.toFixed(2)}) excede o saldo devedor restante (R$ ${remainingBalance.toFixed(2)}).`
        })
    }

    const payingAccountId = body?.accountId || card.account_id
    if (!payingAccountId) {
        return reply.status(400).send({
            message: 'Nenhuma conta bancária foi informada e o cartão não possui conta padrão vinculada.'
        })
    }

    const account = await prisma.account.findUnique({ where: { id: payingAccountId } })
    if (!account) {
        return reply.status(404).send({ message: 'Conta bancária pagadora não encontrada.' })
    }

    const isFullyPaid = (remainingBalance - targetAmountPaid) <= 0.01
    const paymentDate = body?.paymentDate || new Date()
    const paymentMethod = body?.paymentMethod || 'PIX'

    const result = await prisma.$transaction(async (tx) => {
        // A) Cria a transação de despesa real de pagamento da fatura
        const paymentTx = await tx.transaction.create({
            data: {
                operation: 'expense',
                amount: targetAmountPaid,
                totalValue: targetAmountPaid,
                account_id: payingAccountId,
                credit_card_id: id,
                confirmed: true,
                checked: false,
                data_vencimento: paymentDate,
                data_emissao: paymentDate,
                payment_method: paymentMethod,
                description: isFullyPaid
                    ? `Pagamento Fatura: ${card.name} (${month})`
                    : `Pagamento Parcial Fatura: ${card.name} (${month})`
            }
        })

        // B) Debita o saldo da conta bancária pagadora
        await tx.account.update({
            where: { id: payingAccountId },
            data: {
                balance: {
                    decrement: targetAmountPaid
                }
            }
        })

        // C) Se a fatura foi 100% quitada, marca as compras como confirmadas
        if (isFullyPaid) {
            await tx.transaction.updateMany({
                where: {
                    credit_card_id: id,
                    payment_method: 'CREDIT_CARD',
                    data_vencimento: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                data: {
                    confirmed: true
                }
            })
        }

        return {
            paymentTx,
            newRemaining: Number(Math.max(0, remainingBalance - targetAmountPaid).toFixed(2))
        }
    })

    return reply.status(200).send({
        success: true,
        transactionId: result.paymentTx.id,
        paidAmount: targetAmountPaid,
        remainingAmount: result.newRemaining,
        isFullyPaid
    })
}
