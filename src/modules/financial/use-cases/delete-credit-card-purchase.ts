import { prisma } from '@/lib/prisma'

export type DeleteCreditCardPurchaseScope = 'one' | 'forward' | 'all'

export interface DeleteCreditCardPurchaseRequest {
    id: string
    scope: DeleteCreditCardPurchaseScope
}

export interface DeleteCreditCardPurchaseResponse {
    deleted: number
    preserved: number
}

/**
 * Exclui compra(s) no cartão de crédito.
 *
 * - `one`: só a compra clicada. Se já estava paga na fatura, o valor volta para a conta que pagou.
 * - `forward`: a clicada e as parcelas seguintes do mesmo parcelamento.
 * - `all`: o parcelamento inteiro.
 *   Em `forward` e `all`, parcelas já pagas são preservadas (não mexem no saldo do banco).
 */
export class DeleteCreditCardPurchaseUseCase {
    constructor(private prismaClient: any = prisma) {}

    async execute({ id, scope }: DeleteCreditCardPurchaseRequest): Promise<DeleteCreditCardPurchaseResponse> {
        const swipe = await this.prismaClient.transaction.findUnique({ where: { id } })
        if (!swipe) throw new Error('Compra não encontrada.')
        if (!swipe.credit_card_id || swipe.payment_method !== 'CREDIT_CARD') {
            throw new Error('Esta despesa não é uma compra no cartão de crédito.')
        }

        const groupId: string | null = swipe.transaction_group_id
        let targets: any[] = [swipe]

        if (groupId && scope !== 'one') {
            targets = await this.prismaClient.transaction.findMany({
                where: {
                    transaction_group_id: groupId,
                    payment_method: 'CREDIT_CARD',
                    ...(scope === 'forward' ? { data_vencimento: { gte: swipe.data_vencimento } } : {}),
                },
            })
        }

        const toDelete = scope === 'one' ? targets : targets.filter((t) => !t.confirmed)
        const preserved = targets.length - toDelete.length

        if (toDelete.length === 0) {
            throw new Error('Todas essas parcelas já foram pagas na fatura. Nada foi excluído.')
        }

        await this.prismaClient.$transaction(async (tx: any) => {
            for (const t of toDelete) {
                if (t.confirmed && t.account_id) {
                    await tx.account.update({
                        where: { id: t.account_id },
                        data: { balance: { increment: t.totalValue ?? t.amount } },
                    })
                }
                await tx.transaction.delete({ where: { id: t.id } })
            }

            if (groupId) {
                const remaining = await tx.transaction.findMany({
                    where: { transaction_group_id: groupId },
                    select: { amount: true },
                })
                if (remaining.length === 0) {
                    await tx.transactionGroup.delete({ where: { id: groupId } })
                } else {
                    await tx.transactionGroup.update({
                        where: { id: groupId },
                        data: {
                            installmentsCount: remaining.length,
                            totalAmount: Number(remaining.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0).toFixed(2)),
                        },
                    })
                }
            }
        })

        return { deleted: toDelete.length, preserved }
    }
}
