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
    payments?: Array<{
        payment_id: string
        amount: number
        occurrences: number
        date?: Date | string
        is_paid?: boolean
        description?: string
    }>
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
        treatment_id,
        payments
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

        // Use custom payments from frontend if provided, otherwise fallback to DB
        const hasCustomPayments = payments && payments.length > 0
        const totalPaid = hasCustomPayments 
            ? payments.reduce((acc, p) => acc + p.amount, 0) // p.amount is the TOTAL allocated to this method
            : paymentEntries?.reduce((acc, entry) => acc + Number(entry.amount), 0) || 0 // assuming entry.amount is also total

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
                        const product = (tItem as any).product

                        if (product && product.is_composite && product.compositions && product.compositions.length > 0) {
                            for (const comp of product.compositions) {
                                const quantityToDecrease = comp.quantity * tItem.quantity
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
                }
            }

            // B. Financial Transactions
            const itemsToProcess = hasCustomPayments 
                ? payments 
                : paymentEntries?.map(pe => ({
                    payment_id: pe.payment_id,
                    amount: Number(pe.amount),
                    occurrences: pe.occurrences,
                    is_paid: undefined,
                    description: undefined,
                    date: undefined,
                    _method: (pe as any).payments
                })) || []

            if (itemsToProcess.length > 0) {
                for (const entry of itemsToProcess) {
                    let paymentMethod = (entry as any)._method
                    if (!paymentMethod) {
                        paymentMethod = await tx.payment.findUnique({ where: { id: entry.payment_id } })
                    }

                    if (!paymentMethod) continue;

                    const accountId = paymentMethod.account_id

                    if (!accountId) {
                        console.warn(`Payment method ${paymentMethod.name} has no account linked. Skipping transaction creation.`)
                        continue
                    }

                    const installmentAmount = Number((entry.amount / entry.occurrences).toFixed(2))

                    for (let i = 0; i < entry.occurrences; i++) {
                        let dueDate = new Date()
                        if (entry.date) {
                            dueDate = new Date(entry.date)
                        } else {
                            dueDate.setMonth(dueDate.getMonth() + i)
                        }

                        let isConfirmed = paymentMethod.in_sight
                        if (entry.is_paid !== undefined) {
                            isConfirmed = entry.is_paid
                        }

                        let desc = `Atendimento #${treatment.id} - ${paymentMethod.name}`
                        if (entry.description) {
                            desc = entry.description
                        }
                        if (entry.occurrences > 1) {
                            desc += ` (${i + 1}/${entry.occurrences})`
                        }

                        const transaction = await this.transactionsRepository.create({
                            amount: installmentAmount,
                            operation: 'income',
                            data_vencimento: dueDate,
                            account_id: accountId,
                            description: desc,
                            confirmed: isConfirmed,
                            treatment_id: treatment.id // Add relationship
                        } as any, tx)

                        if (isConfirmed) {
                            await this.accountsRepository.changeBalance(accountId, installmentAmount, true, tx)
                        }
                    }
                }
            }

            // C. Close Treatment
            const closedTreatment = await this.treatmentsRepository.close(treatment_id, tx)

            if (!closedTreatment) throw new ResourceNotFoundError()

            // D. Create Sale in background to track metrics separately
            const totalDiscount = (treatment as any).items?.reduce((acc: number, item: any) => acc + (Number(item.discount) || 0), 0) || 0

            const saleItemsData = (treatment as any).items?.map((tItem: any) => ({
                product_id: tItem.product_id || undefined,
                service_id: tItem.service_id || undefined,
                supply_id: tItem.supply_id || undefined,
                quantity: Number(tItem.quantity),
                unit_price: Number(tItem.salesValue) || 0,
                discount: Number(tItem.discount) || 0,
            })) || []

            if (saleItemsData.length > 0) {
                await tx.sale.create({
                    data: {
                        treatment_id: treatment.id,
                        total_amount: Number(treatment.amount),
                        discount: totalDiscount,
                        status: 'COMPLETED',
                        items: {
                            create: saleItemsData
                        }
                    }
                })
            }

            return { treatment: closedTreatment }
        })
    }
}
