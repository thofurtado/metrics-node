import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'
import { PaymentEntrysRepository } from '@/modules/financial/repositories/paymentEntrys-repository'
import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'
import { Treatment } from '@prisma/client'

// Correct Imports
import { ProductsRepository } from '@/modules/items/repositories/products-repository'
import { SuppliesRepository } from '@/modules/items/repositories/supplies-repository'

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
            if ((treatment as any).items && (treatment as any).items.length > 0) {
                for (const tItem of (treatment as any).items) {

                    if (tItem.product_id) {
                        // It is a Product
                        // Cast safe here because Prisma Includes should have populated it if repo is correct
                        // However, Repository typings doesn't guarantee 'product' populated in 'TreatmentItem' type unless explicitly typed.
                        // Assuming findById populates: treatment.items[].product
                        const product = (tItem as any).product

                        if (product && product.is_composite && product.compositions && product.compositions.length > 0) {
                            // Composable Product: Decrease stock from ingredients (Supplies)
                            for (const comp of product.compositions) {
                                const quantityToDecrease = comp.quantity * tItem.quantity

                                // Decrease Stock (False = Out)
                                await this.suppliesRepository.changeStock(comp.supply_id, quantityToDecrease, false, tx)

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
                            await this.productsRepository.changeStock(tItem.product_id, tItem.quantity, false, tx)

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
                        await this.suppliesRepository.changeStock(tItem.supply_id, tItem.quantity, false, tx)

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
                    const paymentMethod = (entry as any).payments

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
