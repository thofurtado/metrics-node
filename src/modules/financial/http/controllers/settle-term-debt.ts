import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function settleTermDebt(request: FastifyRequest, reply: FastifyReply) {
    try {
        const bodySchema = z.object({
            transactionId: z.string().optional().nullable(),
            transactionIds: z.array(z.string()).optional().nullable(),
            targetAccountId: z.string().uuid().optional().nullable(),
            actualPaymentMethod: z.string().optional().nullable(),
            isWriteOff: z.boolean().default(false),
            amountPaid: z.number().positive().optional().nullable(),
            isPayrollDeducted: z.boolean().optional().default(false)
        })

        const {
            transactionId,
            transactionIds,
            targetAccountId,
            actualPaymentMethod,
            isWriteOff,
            amountPaid,
            isPayrollDeducted
        } = bodySchema.parse(request.body)

        const rawIds: string[] = []
        if (transactionIds && transactionIds.length > 0) {
            rawIds.push(...transactionIds)
        } else if (transactionId) {
            rawIds.push(transactionId)
        }

        if (rawIds.length === 0) {
            return reply.status(400).send({ message: 'Nenhum débito ou transação foi informado para baixa.' })
        }

        let totalIncrementAmount = 0
        let settledCount = 0

        for (const id of rawIds) {
            // Caso 1: Débito de Funcionário (PayrollEntry do RH)
            if (id.startsWith('payroll-') || isPayrollDeducted) {
                const payrollId = id.replace('payroll-', '')
                const payrollEntry = await prisma.payrollEntry.findUnique({
                    where: { id: payrollId }
                })

                if (!payrollEntry) {
                    continue
                }

                if (isPayrollDeducted || isWriteOff) {
                    // Abate diretamente na folha de pagamento (não movimenta saldo bancário agora)
                    await prisma.payrollEntry.update({
                        where: { id: payrollId },
                        data: { status: 'DEDUCTED' }
                    })
                    settledCount++
                } else {
                    // Recebimento avulso em balcão (PIX/Dinheiro)
                    if (!targetAccountId) {
                        return reply.status(400).send({ message: 'Conta de destino é obrigatória para recebimentos em balcão.' })
                    }

                    const val = Number(payrollEntry.amount)
                    await prisma.payrollEntry.update({
                        where: { id: payrollId },
                        data: { status: 'PAID_DIRECTLY' }
                    })

                    // Cria receita no financeiro confirmada
                    await prisma.transaction.create({
                        data: {
                            operation: 'income',
                            amount: val,
                            totalValue: val,
                            confirmed: true,
                            account_id: targetAccountId,
                            payment_method: actualPaymentMethod || 'DINHEIRO',
                            data_vencimento: new Date(),
                            data_emissao: new Date(),
                            description: `${payrollEntry.description} (Recebido em Balcão)`,
                        }
                    })

                    totalIncrementAmount += val
                    settledCount++
                }
                continue
            }

            // Caso 2: Débito A Prazo de Cliente (Transaction)
            const pendingTx = await prisma.transaction.findUnique({
                where: { id }
            })

            if (!pendingTx) {
                continue
            }

            if (pendingTx.confirmed) {
                continue
            }

            if (isWriteOff) {
                // Baixa por permuta / perdão (sem dinheiro real)
                await prisma.transaction.update({
                    where: { id: pendingTx.id },
                    data: {
                        confirmed: true,
                        payment_method: 'PERMUTA BAIXADA',
                        operation: 'cashier_summary',
                        description: `${pendingTx.description || 'Débito'} (Baixado por Permuta)`
                    }
                })
                settledCount++
            } else {
                if (!targetAccountId) {
                    return reply.status(400).send({ message: 'Conta de destino é obrigatória para recebimentos normais.' })
                }

                const originalAmount = Number(pendingTx.amount || 0)

                // Verifica se é pagamento parcial (somente permitido quando baixando uma única transação)
                if (rawIds.length === 1 && amountPaid && amountPaid < originalAmount) {
                    const remainingAmount = originalAmount - amountPaid

                    // 1. Atualiza a transação atual com o valor recebido e confirma
                    await prisma.transaction.update({
                        where: { id: pendingTx.id },
                        data: {
                            confirmed: true,
                            account_id: targetAccountId,
                            amount: amountPaid,
                            totalValue: amountPaid,
                            payment_method: actualPaymentMethod || 'DINHEIRO',
                            data_vencimento: new Date(),
                            description: `${pendingTx.description || 'Venda A Prazo'} (Baixa Parcial)`
                        }
                    })

                    // 2. Cria uma nova transação pendente com o valor restante
                    await prisma.transaction.create({
                        data: {
                            operation: 'income',
                            amount: remainingAmount,
                            totalValue: remainingAmount,
                            confirmed: false,
                            account_id: pendingTx.account_id,
                            cashier_session_id: pendingTx.cashier_session_id,
                            payment_method: pendingTx.payment_method || 'A PRAZO',
                            data_vencimento: pendingTx.data_vencimento || new Date(),
                            data_emissao: pendingTx.data_emissao || new Date(),
                            description: `${pendingTx.description || 'Venda A Prazo'} (Saldo Restante)`
                        }
                    })

                    totalIncrementAmount += amountPaid
                    settledCount++
                } else {
                    // Quitação total
                    await prisma.transaction.update({
                        where: { id: pendingTx.id },
                        data: {
                            confirmed: true,
                            account_id: targetAccountId,
                            payment_method: actualPaymentMethod || 'DINHEIRO',
                            data_vencimento: new Date(),
                            description: `${pendingTx.description || 'Venda A Prazo'} (Liquidado)`
                        }
                    })

                    totalIncrementAmount += originalAmount
                    settledCount++
                }
            }
        }

        // Incrementa o saldo da conta de destino com o total líquido recebido
        if (targetAccountId && totalIncrementAmount > 0) {
            await prisma.account.update({
                where: { id: targetAccountId },
                data: { balance: { increment: totalIncrementAmount } }
            })
        }

        return reply.status(200).send({
            message: `${settledCount} ${settledCount === 1 ? 'débito liquidado' : 'débitos liquidados'} com sucesso!`,
            settledCount,
            totalReceived: totalIncrementAmount
        })
    } catch (error: any) {
        console.error('[settleTermDebt Error]', error)
        return reply.status(500).send({ message: error?.message || 'Erro ao liquidar débito.' })
    }
}
