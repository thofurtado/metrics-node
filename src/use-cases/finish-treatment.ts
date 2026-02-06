import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { PaymentEntrysRepository } from '@/repositories/paymentEntrys-repository'
import { ItemsRepository } from '@/repositories/items-repository'
import { TransactionsRepository } from '@/repositories/transactions-repository'
import { AccountsRepository } from '@/repositories/accounts-repository'
import { ProductsRepository } from '@/repositories/products-repository'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'
import { Treatment } from '@prisma/client'

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
        private productsRepository: ProductsRepository,
        private suppliesRepository: SuppliesRepository
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

        const paymentEntries = await this.paymentEntrysRepository.findByTreatmentId(treatment_id)

        const totalPaid = paymentEntries?.reduce((acc, entry) => acc + (Number(entry.amount) * entry.occurrences), 0) || 0

        // Tolerância de 5 centavos
        if (totalPaid < (treatment.amount - 0.05)) {
            throw new Error(`Pagamento insuficiente. Total a pagar: ${treatment.amount.toFixed(2)}, Pago: ${totalPaid.toFixed(2)}`)
        }

        // 2. Execution (Transaction)
        return await prisma.$transaction(async (tx) => {

            // A. Stock Update (Decrement)
            // Checks explicit types using relations product_id and supply_id
            // @ts-ignore
            if (treatment.items && treatment.items.length > 0) {
                // @ts-ignore
                for (const tItem of treatment.items) {

                    if (tItem.product_id) {
                        // It is a Product
                        // @ts-ignore
                        const product = tItem.product

                        if (product && product.is_composite && product.compositions && product.compositions.length > 0) {
                            // Composable Product: Decrease stock from ingredients (Supplies)
                            for (const comp of product.compositions) {
                                const quantityToDecrease = comp.quantity * tItem.quantity

                                await this.suppliesRepository.decreaseStock(comp.supply_id, quantityToDecrease, tx)

                                await tx.stock.create({
                                    data: {
                                        supply_id: comp.supply_id,
                                        quantity: quantityToDecrease,
                                        operation: 'OUT',
                                        description: 'VENDA',
                                        created_at: new Date()
                                    }
                                })
                            }

                        } else {
                            // Standard Product: Decrease stock from the product itself
                            await this.productsRepository.decreaseStock(tItem.product_id, tItem.quantity, tx)

                            await tx.stock.create({
                                data: {
                                    product_id: tItem.product_id,
                                    quantity: tItem.quantity,
                                    operation: 'OUT',
                                    description: 'VENDA',
                                    created_at: new Date()
                                }
                            })
                        }

                    } else if (tItem.supply_id) {
                        // It is a Supply
                        await this.suppliesRepository.decreaseStock(tItem.supply_id, tItem.quantity, tx)

                        await tx.stock.create({
                            data: {
                                supply_id: tItem.supply_id,
                                quantity: tItem.quantity,
                                operation: 'OUT',
                                description: 'VENDA',
                                created_at: new Date()
                            }
                        })
                    }
                    // Services (service_id) do not consume stock
                }
            }

            // B. Financial Transactions
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
