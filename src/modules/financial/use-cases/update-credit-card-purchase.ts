import { prisma } from '@/lib/prisma'
import { calculateCreditCardDueDate } from '@/modules/financial/services/credit-card-due-date'

export interface UpdateCreditCardPurchaseRequest {
    id: string
    amount?: number
    description?: string | null
    sector_id?: string | null
    supplier_id?: string | null
    data_emissao?: Date
    credit_card_id?: string
}

function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Edita uma compra no cartão de crédito (a despesa que fica escondida na lista e aparece só dentro da fatura).
 *
 * - Compra pendente: pode mudar tudo. Mudando a data da compra ou o cartão, o vencimento (e a fatura) é recalculado aqui.
 * - Compra já paga na fatura: só valor, descrição, setor e fornecedor. Mudando o valor, o saldo da conta que pagou
 *   é ajustado pela diferença.
 */
export class UpdateCreditCardPurchaseUseCase {
    constructor(private prismaClient: any = prisma) {}

    async execute(input: UpdateCreditCardPurchaseRequest) {
        const { id, amount, description, sector_id, supplier_id, data_emissao, credit_card_id } = input

        const swipe = await this.prismaClient.transaction.findUnique({ where: { id } })
        if (!swipe) throw new Error('Compra não encontrada.')
        if (!swipe.credit_card_id || swipe.payment_method !== 'CREDIT_CARD') {
            throw new Error('Esta despesa não é uma compra no cartão de crédito.')
        }
        if (amount !== undefined && !(amount > 0)) {
            throw new Error('O valor da compra deve ser maior que zero.')
        }

        const paid: boolean = swipe.confirmed
        const emissaoChanged = data_emissao !== undefined && !sameDay(new Date(data_emissao), new Date(swipe.data_emissao))
        const cardChanged = credit_card_id !== undefined && credit_card_id !== swipe.credit_card_id

        if (paid && (emissaoChanged || cardChanged)) {
            throw new Error('Compra de fatura já paga: só dá para mudar valor, descrição, setor e fornecedor.')
        }

        const data: Record<string, unknown> = {}
        if (description !== undefined) data.description = description
        if (sector_id !== undefined) data.sector_id = sector_id
        if (supplier_id !== undefined) data.supplier_id = supplier_id

        if (!paid && (emissaoChanged || cardChanged)) {
            const card = await this.prismaClient.creditCard.findUnique({
                where: { id: credit_card_id ?? swipe.credit_card_id },
            })
            if (!card) throw new Error('Cartão de crédito não encontrado.')

            const emissao = emissaoChanged ? new Date(data_emissao as Date) : new Date(swipe.data_emissao)
            const holidays = await this.prismaClient.holiday.findMany({ select: { date: true } })
            const holidayStrings = holidays.map((h: { date: Date }) => h.date.toISOString().slice(0, 10))

            data.data_vencimento = calculateCreditCardDueDate(emissao, card, holidayStrings).due_date
            if (emissaoChanged) data.data_emissao = emissao
            if (cardChanged) {
                data.credit_card_id = card.id
                if (card.account_id) data.account_id = card.account_id
            }
        }

        const oldAmount: number = swipe.amount
        const oldEffective: number = swipe.totalValue ?? swipe.amount
        const newAmount: number = amount !== undefined ? Number(amount.toFixed(2)) : oldAmount
        const amountChanged = Math.abs(newAmount - oldAmount) > 0.001 || (paid && Math.abs(newAmount - oldEffective) > 0.001)

        if (amountChanged) {
            data.amount = newAmount
            if (paid) data.totalValue = newAmount
        } else if (paid && swipe.totalValue == null) {
            // Compras quitadas antes desta versão ficaram sem totalValue e sumiam das somas de "pago".
            data.totalValue = oldAmount
        }

        return await this.prismaClient.$transaction(async (tx: any) => {
            if (paid && amountChanged && swipe.account_id) {
                const delta = Number((newAmount - oldEffective).toFixed(2))
                // Despesa paga: valor maior tira mais da conta, menor devolve a diferença.
                await tx.account.update({
                    where: { id: swipe.account_id },
                    data: { balance: { decrement: delta } },
                })
            }

            const updated = await tx.transaction.update({ where: { id }, data })

            if (amountChanged && swipe.transaction_group_id) {
                await tx.transactionGroup.update({
                    where: { id: swipe.transaction_group_id },
                    data: { totalAmount: { increment: Number((newAmount - oldAmount).toFixed(2)) } },
                })
            }

            return { transaction: updated }
        })
    }
}
