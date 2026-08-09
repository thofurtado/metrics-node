import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function listSettlements(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('10'),
        sortBy: z.string().optional().default('data_vencimento'),
        sortDir: z.string().optional().default('desc'),
    })
    const { page, limit, sortBy, sortDir } = querySchema.parse(request.query)
    const take = parseInt(limit, 10)
    const skip = (parseInt(page, 10) - 1) * take

    const whereClause: any = {
        confirmed: true,
        operation: 'income',
        payment_method: { 
            in: [
                'CREDITO', 'DEBITO', 'PIX', 'VOUCHER', 
                'crédito', 'débito', 'pix', 'voucher',
                'Crédito', 'Débito', 'Pix', 'Voucher',
                'Cartão de Crédito', 'Cartão de Débito',
                'cartão de crédito', 'cartão de débito',
                'Cartão de crédito', 'Cartão de débito'
            ]
        },
        cashier_session_id: { not: null }
    }

    const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where: whereClause,
            orderBy: { [sortBy]: sortDir === 'asc' ? 'asc' : 'desc' },
            include: { accounts: true },
            skip,
            take,
        }),
        prisma.transaction.count({ where: whereClause })
    ])

    return reply.status(200).send({
        data: transactions,
        meta: {
            total,
            page: parseInt(page, 10),
            limit: take,
            totalPages: Math.ceil(total / take)
        }
    })
}

export async function revertSettlement(request: FastifyRequest, reply: FastifyReply) {
    const revertSchema = z.object({ id: z.string().uuid() })
    const { id } = revertSchema.parse(request.params)

    const transaction = await prisma.transaction.findUnique({
        where: { id }
    })

    if (!transaction) {
        return reply.status(404).send({ message: 'Transação não encontrada.' })
    }

    try {
        await prisma.transaction.update({
            where: { id },
            data: { confirmed: false }
        })

        return reply.status(200).send({ message: 'Liquidação revertida com sucesso.' })
    } catch (error: any) {
        console.error('Error reverting settlement:', error)
        return reply.status(500).send({ message: 'Erro ao reverter liquidação.', details: error.message })
    }
}

export async function getPendingSettlements(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('50'),
        sortBy: z.string().optional().default('data_vencimento'),
        sortDir: z.string().optional().default('asc'),
    })
    const { page, limit, sortBy, sortDir } = querySchema.parse(request.query)
    const take = parseInt(limit, 10)
    const skip = (parseInt(page, 10) - 1) * take

    const whereClause: any = {
        confirmed: false,
        operation: 'income',
        payment_method: { 
            in: [
                'CREDITO', 'DEBITO', 'PIX', 'VOUCHER', 
                'crédito', 'débito', 'pix', 'voucher',
                'Crédito', 'Débito', 'Pix', 'Voucher',
                'Cartão de Crédito', 'Cartão de Débito',
                'cartão de crédito', 'cartão de débito',
                'Cartão de crédito', 'Cartão de débito'
            ]
        }
    }

    const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where: whereClause,
            orderBy: { [sortBy]: sortDir === 'asc' ? 'asc' : 'desc' },
            include: { accounts: true },
            skip,
            take,
        }),
        prisma.transaction.count({ where: whereClause })
    ])

    return reply.status(200).send({
        data: transactions,
        meta: {
            total,
            page: parseInt(page, 10),
            limit: take,
            totalPages: Math.ceil(total / take)
        }
    })
}
