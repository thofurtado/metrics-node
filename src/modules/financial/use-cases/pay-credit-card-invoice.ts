import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { getCleanRemainingDescription } from '@/modules/financial/use-cases/change-transaction-status'

export interface PayCreditCardInvoiceRequest {
    creditCardId: string
    month: string // Format: 'YYYY-MM'
    amountPaid?: number
    accountId?: string
    paymentDate?: Date
    paymentMethod?: string
}

export interface PayCreditCardInvoiceResponse {
    paidAmount: number
    remainingAmount: number
    isFullyPaid: boolean
    confirmedCount: number
    splitOccurred: boolean
}

export class PayCreditCardInvoiceUseCase {
    constructor(private prismaClient: any = prisma) {}

    async execute({
        creditCardId,
        month,
        amountPaid,
        accountId,
        paymentDate,
        paymentMethod
    }: PayCreditCardInvoiceRequest): Promise<PayCreditCardInvoiceResponse> {
        const card = await this.prismaClient.creditCard.findUnique({
            where: { id: creditCardId },
            include: { account: true }
        })

        if (!card) {
            throw new ResourceNotFoundError('Cartão de crédito não encontrado')
        }

        const [year, m] = month.split('-').map(Number)
        if (!year || !m || m < 1 || m > 12) {
            throw new Error('Mês inválido. Formato esperado: YYYY-MM')
        }

        const startDate = new Date(year, m - 1, 1, 0, 0, 0, 0)
        const endDate = new Date(year, m, 0, 23, 59, 59, 999)

        // 1. Buscar todas as compras pendentes desse cartão no mês informado (FIFO cronológico)
        const pendingSwipes = await this.prismaClient.transaction.findMany({
            where: {
                credit_card_id: creditCardId,
                payment_method: 'CREDIT_CARD',
                confirmed: false,
                data_vencimento: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: [
                { data_vencimento: 'asc' },
                { created_at: 'asc' }
            ]
        })

        if (pendingSwipes.length === 0) {
            throw new Error('Não há compras pendentes para este cartão no mês informado.')
        }

        const totalPending = pendingSwipes.reduce((acc: number, s: any) => acc + (s.totalValue ?? s.amount), 0)
        const targetAmountPaid = Number((amountPaid ?? totalPending).toFixed(2))

        if (targetAmountPaid <= 0.01) {
            throw new Error('O valor pago deve ser maior que zero.')
        }

        if (targetAmountPaid > totalPending + 0.01) {
            throw new Error(`O valor informado (R$ ${targetAmountPaid.toFixed(2)}) excede o saldo devedor restante (R$ ${totalPending.toFixed(2)}).`)
        }

        const payingAccountId = accountId || card.account_id
        if (!payingAccountId) {
            throw new Error('Nenhuma conta bancária foi informada e o cartão não possui conta padrão vinculada.')
        }

        const account = await this.prismaClient.account.findUnique({ where: { id: payingAccountId } })
        if (!account) {
            throw new ResourceNotFoundError('Conta bancária pagadora não encontrada.')
        }

        return await this.prismaClient.$transaction(async (tx: any) => {
            // A) Debita o saldo real da conta bancária pagadora
            await tx.account.update({
                where: { id: payingAccountId },
                data: {
                    balance: {
                        decrement: targetAmountPaid
                    }
                }
            })

            // B) Amortização sequencial nas compras pendentes (Opção B)
            let remainingToPay = targetAmountPaid
            let confirmedCount = 0
            let splitOccurred = false

            for (const swipe of pendingSwipes) {
                if (remainingToPay <= 0.001) break

                const swipeAmount = swipe.totalValue ?? swipe.amount

                if (remainingToPay >= swipeAmount - 0.001) {
                    // Quita a compra 100% no setor original dela
                    await tx.transaction.update({
                        where: { id: swipe.id },
                        data: {
                            confirmed: true,
                            account_id: payingAccountId
                        }
                    })
                    remainingToPay = Number((remainingToPay - swipeAmount).toFixed(2))
                    confirmedCount++
                } else {
                    // Pagamento parcial desta compra: DESMEMBRAMENTO (Split)
                    const paidPart = Number(remainingToPay.toFixed(2))
                    const unpaidPart = Number((swipeAmount - remainingToPay).toFixed(2))

                    // 1. Atualiza a compra original com a parte paga e confirma no setor dela
                    await tx.transaction.update({
                        where: { id: swipe.id },
                        data: {
                            amount: paidPart,
                            totalValue: paidPart,
                            confirmed: true,
                            account_id: payingAccountId
                        }
                    })
                    confirmedCount++

                    // 2. Cria a parcela restante pendente usando a convenção padrão PR (N)
                    const cleanDescription = getCleanRemainingDescription(swipe as any)

                    await tx.transaction.create({
                        data: {
                            operation: swipe.operation,
                            amount: unpaidPart,
                            totalValue: unpaidPart,
                            account_id: swipe.account_id,
                            sector_id: swipe.sector_id,
                            supplier_id: swipe.supplier_id,
                            credit_card_id: swipe.credit_card_id,
                            payment_method: 'CREDIT_CARD',
                            description: cleanDescription,
                            confirmed: false,
                            data_vencimento: swipe.data_vencimento,
                            data_emissao: swipe.data_emissao,
                            parent_transaction_id: swipe.id,
                            transaction_group_id: swipe.transaction_group_id
                        }
                    })

                    remainingToPay = 0
                    splitOccurred = true
                    break
                }
            }

            const newRemainingInvoiceBalance = Number(Math.max(0, totalPending - targetAmountPaid).toFixed(2))

            return {
                paidAmount: targetAmountPaid,
                remainingAmount: newRemainingInvoiceBalance,
                isFullyPaid: newRemainingInvoiceBalance <= 0.01,
                confirmedCount,
                splitOccurred
            }
        })
    }
}
