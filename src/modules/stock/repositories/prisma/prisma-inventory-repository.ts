// repositories/prisma/prisma-inventory-repository.ts
import { Prisma } from '@prisma/client'
import { InventoryRepository, InventorySummaryData } from '@/modules/stock/repositories/inventory-repository'
import { prisma } from '@/lib/prisma'

export class PrismaInventoryRepository implements InventoryRepository {
    async getInventorySummary(): Promise<InventorySummaryData> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()
        const startOfMonth = new Date(currentYear, currentMonth, 1)
        const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1)

        // 1. Patrimônio
        // Sum of (Product.stock * Product.price) + (Supply.stock * Supply.cost)

        const [products, supplies] = await Promise.all([
            prisma.product.findMany({
                select: {
                    stock: true,
                    price: true
                }
            }),
            prisma.supply.findMany({
                select: {
                    stock: true,
                    cost: true
                }
            })
        ])

        const productsValue = products.reduce((sum, p) => sum + ((p.stock || 0) * p.price), 0)
        const suppliesValue = supplies.reduce((sum, s) => sum + ((s.stock || 0) * s.cost), 0)

        const patrimony = productsValue + suppliesValue

        // 2. Sales / Budgets
        const salesStatuses = ['resolved', 'finished']

        const monthlyItems = await prisma.treatmentItem.findMany({
            where: {
                treatments: {
                    opening_date: {
                        gte: startOfMonth,
                        lt: startOfNextMonth
                    }
                }
            },
            select: {
                quantity: true,
                salesValue: true,
                discount: true,
                product_id: true,
                service_id: true,
                treatments: {
                    select: {
                        status: true
                    }
                }
            }
        })

        let productsSoldValue = 0
        let servicesSoldValue = 0
        let productsBudgetValue = 0
        let servicesBudgetValue = 0

        for (const item of monthlyItems) {
            const quantity = item.quantity || 0
            const salesValue = item.salesValue || 0
            const discount = item.discount || 0

            // Valor Líquido = (Preço * Qtd) - Desconto
            // salesValue comes from TreatmentItem snapshot.
            const totalItemValue = (quantity * salesValue) - discount

            const isProduct = !!item.product_id
            const isService = !!item.service_id

            const isSale = item.treatments.status && salesStatuses.includes(item.treatments.status)

            if (isProduct) {
                if (isSale) {
                    productsSoldValue += totalItemValue
                } else {
                    productsBudgetValue += totalItemValue
                }
            } else if (isService) {
                if (isSale) {
                    servicesSoldValue += totalItemValue
                } else {
                    servicesBudgetValue += totalItemValue
                }
            }
        }

        return {
            patrimony,
            productsSold: Number(productsSoldValue.toFixed(2)),
            servicesSold: Number(servicesSoldValue.toFixed(2)),
            productsBudget: Number(productsBudgetValue.toFixed(2)),
            servicesBudget: Number(servicesBudgetValue.toFixed(2))
        }
    }
}