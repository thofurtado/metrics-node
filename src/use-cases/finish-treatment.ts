import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { PaymentEntrysRepository } from '@/repositories/paymentEntrys-repository'
import { ItemsRepository } from '@/repositories/items-repository'
import { TransactionsRepository } from '@/repositories/transactions-repository'
import { AccountsRepository } from '@/repositories/accounts-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'
import { Treatment, ItemType } from '@prisma/client'

interface FinishTreatmentUseCaseRequest {
    treatment_id: string
}

interface FinishTreatmentUseCaseResponse {
    treatment: Treatment
}

export class FinishTreatmentUseCase {
    constructor(
        private treatmentsRepository: TreatmentsRepository,
        private paymentEntrysRepository: PaymentEntrysRepository,
        private itemsRepository: ItemsRepository,
        private transactionsRepository: TransactionsRepository,
        private accountsRepository: AccountsRepository,
    ) { }

    async execute({
        treatment_id
    }: FinishTreatmentUseCaseRequest): Promise<FinishTreatmentUseCaseResponse> {

        // 1. Validation (Read-only first)
        const treatment = await this.treatmentsRepository.findById(treatment_id)
        if (!treatment) {
            throw new ResourceNotFoundError()
        }

        if (treatment.status === 'resolved' || treatment.status === 'finished') {
            throw new Error('Treatment already finished')
        }

        // Calculate total amount from items for validation
        const calculatedTotal = treatment.amount

        // Note: treatment.amount is now dynamically calculated by the repository's findById method.
        // It does not exist in the database, so we do not need to "sync" or "fix" it here.


        const paymentEntries = await this.paymentEntrysRepository.findByTreatmentId(treatment_id)
        // paymentEntries includes 'payments' relation now (via repository update)

        // Validação de Pagamento
        // O sistema verifica se o total pago corresponde ao valor do atendimento.
        // - Contrato 100%: Valor = 0, Pago = 0 (OK)
        // - Contrato + Peça: Valor = 50, Pago = 50 (OK)
        // - Normal: Valor = 100, Pago = 100 (OK)
        // If the amount is > 0, it means some items were added WITHOUT contract mode toggle.
        // We could either block or just proceed assuming they serve as extra charge?
        // Requirement: "Se o atendimento for marcado como 'Contrato', o Use Case deve validar que o saldo a pagar é R$ 0,00."
        // But wait, "marcado como Contrato" -> this is implicitly determined by the Client.contract field?
        // Or determines based on if the user wants to close it as such?
        // The prompt implies the condition is "Client.contract == true".
        // Let's stick to: If client.contract == true, we treat as contract flow.

        // Validação de Pagamento
        // Independente de ser contrato ou não, se existe valor a ser cobrado (treatment.amount > 0),
        // deve haver pagamentos correspondentes.
        // Se for tudo coberto por contrato (descontos), treatment.amount será 0 e totalPaid pode ser 0.

        const totalPaid = paymentEntries?.reduce((acc, entry) => acc + (Number(entry.amount) * entry.occurrences), 0) || 0

        // Tolerância de 5 centavos
        if (totalPaid < (treatment.amount - 0.05)) {
            throw new Error(`Pagamento insuficiente. Total a pagar: ${treatment.amount.toFixed(2)}, Pago: ${totalPaid.toFixed(2)}`)
        }

        // 2. Execution (Transaction)
        return await prisma.$transaction(async (tx) => {

            // A. Stock Update (Decrement)
            // @ts-ignore
            if (treatment.items) {
                // @ts-ignore
                for (const tItem of treatment.items) {

                    // @ts-ignore
                    const itemData = tItem.items

                    if (itemData && (itemData.type === ItemType.PRODUCT || itemData.type === ItemType.SUPPLY)) {
                        // It is a physical item, decrement stock
                        await this.itemsRepository.changeStock(tItem.item_id, tItem.quantity, false, tx) // false = OUT

                        await tx.stock.create({
                            data: {
                                item_id: tItem.item_id,
                                quantity: tItem.quantity,
                                // @ts-ignore
                                operation: 'OUT',
                                // @ts-ignore
                                description: 'VENDA',
                                created_at: new Date()
                            }
                        })
                    }
                }
            }

            // B. Financial Transactions
            // Generate transactions for whatever amount was paid.
            // If contract covered everything (amount=0), paymentEntries should be empty or 0, loop won't run.
            // If parts were charged (amount>0), paymentEntries will exist.
            if (paymentEntries) {
                for (const entry of paymentEntries) {
                    // @ts-ignore
                    const paymentMethod = entry.payments

                    if (!paymentMethod) continue;

                    const accountId = paymentMethod.account_id

                    if (!accountId) {
                        console.warn(`Payment method ${paymentMethod.name} has no account linked. Skipping transaction creation.`)
                        continue
                    }

                    for (let i = 0; i < entry.occurrences; i++) {
                        const dueDate = new Date()
                        dueDate.setMonth(dueDate.getMonth() + i)

                        let isConfirmed = false

                        if (paymentMethod.in_sight) {
                            isConfirmed = true
                        }

                        const transaction = await this.transactionsRepository.create({
                            amount: entry.amount,
                            operation: 'income',
                            date: dueDate,
                            account_id: accountId,
                            description: `Atendimento #${treatment.id} - ${paymentMethod.name} (${i + 1}/${entry.occurrences})`,
                            confirmed: isConfirmed,
                        }, tx)

                        if (isConfirmed) {
                            await this.accountsRepository.changeBalance(accountId, entry.amount, true, tx)
                        }
                    }
                }
            }

            // C. Close Treatment
            const closedTreatment = await this.treatmentsRepository.close(treatment_id, tx)

            if (!closedTreatment) throw new ResourceNotFoundError()

            return { treatment: closedTreatment }
        })
    }
}
