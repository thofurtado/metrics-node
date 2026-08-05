import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function listSettlements(request: FastifyRequest, reply: FastifyReply) {
    const settlements = await prisma.transferTransaction.findMany({
        where: { is_automated: true },
        orderBy: { created_at: 'desc' },
        include: {
            sourceTransaction: { include: { accounts: true, creditCard: true } },
            destTransaction: { include: { accounts: true } }
        }
    })
    return reply.status(200).send(settlements)
}

export async function revertSettlement(request: FastifyRequest, reply: FastifyReply) {
    const revertSchema = z.object({ id: z.string().uuid() })
    const { id } = revertSchema.parse(request.params)

    const transfer = await prisma.transferTransaction.findUnique({
        where: { id }
    })

    if (!transfer) {
        return reply.status(404).send({ message: 'Liquidação não encontrada.' })
    }

    try {
        await prisma.transferTransaction.delete({
            where: { id }
        })

        await prisma.transaction.deleteMany({
            where: {
                id: {
                    in: [transfer.source_transaction_id, transfer.dest_transaction_id]
                }
            }
        })

        return reply.status(200).send({ message: 'Liquidação revertida com sucesso.' })
    } catch (error: any) {
        console.error('Error reverting settlement:', error)
        return reply.status(500).send({ message: 'Erro ao reverter liquidação.', details: error.message })
    }
}

export async function getPendingSettlements(request: FastifyRequest, reply: FastifyReply) {
    // Localizar a conta transitória
    const transitAccount = await prisma.account.findFirst({ where: { is_transit: true } })
    if (!transitAccount) {
        return reply.status(400).send({ message: 'Conta transitória não encontrada.' })
    }

    // Buscar transações na conta transitória que não estão confirmadas
    const pendingTransactions = await prisma.transaction.findMany({
        where: {
            account_id: transitAccount.id,
            confirmed: false,
            operation: 'income',
        },
        orderBy: {
            data_vencimento: 'asc'
        }
    })

    return reply.status(200).send(pendingTransactions)
}
