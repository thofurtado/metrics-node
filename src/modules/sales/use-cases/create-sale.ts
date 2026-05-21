import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { PaymentsRepository } from '@/modules/financial/repositories/payments-repository'
import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { ProductsRepository } from '@/modules/items/repositories/products-repository'
import { SuppliesRepository } from '@/modules/items/repositories/supplies-repository'
import { Sale } from '@prisma/client'
import { SalesRepository } from '../repositories/sales-repository'

interface SaleItemInput {
    product_id?: string
    service_id?: string
    supply_id?: string
    quantity: number
    salesValue: number
    discount?: number
}

interface PaymentInput {
    payment_id: string
    amount: number
    occurrences: number
}

interface CreateSaleUseCaseRequest {
    items: SaleItemInput[]
    discount?: number
    payments: PaymentInput[]
}

interface CreateSaleUseCaseResponse {
    sale: Sale
}

export class CreateSaleUseCase {
    constructor(
        private salesRepository: SalesRepository,
        private productsRepository: ProductsRepository,
        private suppliesRepository: SuppliesRepository,
        private transactionsRepository: TransactionsRepository,
        private accountsRepository: AccountsRepository,
        private paymentsRepository: PaymentsRepository
    ) {}

    async execute({
        items,
        discount = 0,
        payments
    }: CreateSaleUseCaseRequest): Promise<CreateSaleUseCaseResponse> {
        if (!items || items.length === 0) {
            throw new Error('Sale must have at least one item.')
        }

        // Calculate total amount
        const calculatedTotal = items.reduce((acc, item) => {
            const qty = Number(item.quantity) || 0
            const val = Number(item.salesValue) || 0
            const disc = Number(item.discount) || 0
            return acc + (qty * val - disc)
        }, 0)

        const finalTotal = Math.max(0, calculatedTotal - discount)

        // Verify payments
        const totalPaid = payments.reduce((acc, p) => acc + (Number(p.amount) * p.occurrences), 0)
        if (totalPaid < (finalTotal - 0.05)) {
            throw new Error(`Insufficient payment. Total: R$ ${finalTotal.toFixed(2)}, Paid: R$ ${totalPaid.toFixed(2)}`)
        }

        // Pre-fetch payment methods properties to avoid repo calls inside transaction loop if possible,
        // or just fetch outside.
        const paymentMethodsMap = new Map()
        for (const p of payments) {
            const method = await this.paymentsRepository.findById(p.payment_id)
            if (!method) {
                throw new Error(`Payment method ${p.payment_id} not found`)
            }
            paymentMethodsMap.set(p.payment_id, method)
        }

        // Execute in transaction
        const sale = await prisma.$transaction(async (tx) => {
            // A. Create the Sale & SaleItems
            const saleItemsData = items.map((item) => ({
                product_id: item.product_id || null,
                service_id: item.service_id || null,
                supply_id: item.supply_id || null,
                quantity: Number(item.quantity),
                unit_price: Number(item.salesValue),
                discount: Number(item.discount) || 0,
            }))

            const createdSale = await tx.sale.create({
                data: {
                    total_amount: Number(finalTotal.toFixed(2)),
                    discount: Number(discount),
                    status: 'COMPLETED',
                    items: {
                        create: saleItemsData
                    }
                }
            })

            // B. Decrement Stocks
            for (const item of items) {
                if (item.product_id) {
                    const product = await this.productsRepository.findById(item.product_id)
                    if (!product) continue

                    if (product.is_composite && product.compositions && product.compositions.length > 0) {
                        // Composed
                        for (const comp of product.compositions) {
                            const quantityToDecrease = comp.quantity * Number(item.quantity)

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
                        // Standard Product
                        await this.productsRepository.changeStock(item.product_id, Number(item.quantity), false, tx)

                        await tx.stock.create({
                            data: {
                                product_id: item.product_id,
                                quantity: Number(item.quantity),
                                operation: 'OUT',
                                description: 'VENDA',
                                created_at: new Date()
                            }
                        })
                    }
                } else if (item.supply_id) {
                    // Direct Supply sale
                    await this.suppliesRepository.changeStock(item.supply_id, Number(item.quantity), false, tx)

                    await tx.stock.create({
                        data: {
                            supply_id: item.supply_id,
                            quantity: Number(item.quantity),
                            operation: 'OUT',
                            description: 'VENDA',
                            created_at: new Date()
                        }
                    })
                }
            }

            // C. Financial Transactions
            for (const p of payments) {
                const methodInfo = paymentMethodsMap.get(p.payment_id)
                const accountId = methodInfo.account_id

                if (!accountId) {
                    console.warn(`Payment method ${methodInfo.name} has no account linked. Skipping transaction.`)
                    continue
                }

                for (let i = 0; i < p.occurrences; i++) {
                    const dueDate = new Date()
                    dueDate.setMonth(dueDate.getMonth() + i)

                    const isConfirmed = !!methodInfo.in_sight

                    await this.transactionsRepository.create({
                        amount: Number(p.amount),
                        operation: 'income',
                        date: dueDate,
                        account_id: accountId,
                        description: `Venda PDV #${createdSale.id.substring(0, 8)} - ${methodInfo.name} (${i + 1}/${p.occurrences})`,
                        confirmed: isConfirmed,
                    }, tx)

                    if (isConfirmed) {
                        await this.accountsRepository.changeBalance(accountId, Number(p.amount), true, tx)
                    }
                }
            }

            return createdSale
        })

        return {
            sale
        }
    }
}
