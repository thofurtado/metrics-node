// repositories/prisma/prisma-inventory-repository.ts
import { Prisma } from '@prisma/client'
import { InventoryRepository, InventorySummaryData } from '../inventory-repository'
import { prisma } from '@/lib/prisma'

export class PrismaInventoryRepository implements InventoryRepository {
    async getInventorySummary(): Promise<InventorySummaryData> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()
        const startOfMonth = new Date(currentYear, currentMonth, 1)
        const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1)

        // 1. Patrimônio: soma de (stock * cost) para todos os produtos (isItem = true)
        const items = await prisma.item.findMany({
            where: {
                isItem: true,
                active: true
            },
            select: {
                stock: true,
                cost: true
            }
        })

        const patrimony = items.reduce((sum, item) => {
            const itemStock = item.stock || 0
            const itemCost = item.cost || 0
            return sum + (itemStock * itemCost)
        }, 0)

        // 2. Valor Total de Produtos Vendidos: soma de (quantity * salesValue) para itens (isItem = true)
        const productsSoldResult = await prisma.treatmentItem.aggregate({
            _sum: {
                quantity: true
            },
            where: {
                AND: [
                    {
                        treatments: {
                            opening_date: {
                                gte: startOfMonth,
                                lt: startOfNextMonth
                            }
                        }
                    },
                    {
                        items: {
                            isItem: true
                        }
                    }
                ]
            }
        })

        // Buscar os TreatmentItems para calcular o valor total
        const productItems = await prisma.treatmentItem.findMany({
            where: {
                AND: [
                    {
                        treatments: {
                            opening_date: {
                                gte: startOfMonth,
                                lt: startOfNextMonth
                            }
                        }
                    },
                    {
                        items: {
                            isItem: true
                        }
                    }
                ]
            },
            select: {
                quantity: true,
                salesValue: true
            }
        })

        const productsSoldValue = productItems.reduce((sum, item) => {
            const quantity = item.quantity || 0
            const salesValue = item.salesValue || 0
            return sum + (quantity * salesValue)
        }, 0)

        // 3. Valor Total de Serviços Vendidos: soma de (quantity * salesValue) para serviços (isItem = false)
        const serviceItems = await prisma.treatmentItem.findMany({
            where: {
                AND: [
                    {
                        treatments: {
                            opening_date: {
                                gte: startOfMonth,
                                lt: startOfNextMonth
                            }
                        }
                    },
                    {
                        items: {
                            isItem: false
                        }
                    }
                ]
            },
            select: {
                quantity: true,
                salesValue: true
            }
        })

        const servicesSoldValue = serviceItems.reduce((sum, item) => {
            const quantity = item.quantity || 0
            const salesValue = item.salesValue || 0
            return sum + (quantity * salesValue)
        }, 0)

        return {
            patrimony,
            productsSold: productsSoldValue,
            servicesSold: servicesSoldValue
        }
    }
}