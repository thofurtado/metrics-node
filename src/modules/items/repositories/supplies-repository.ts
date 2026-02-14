import { Prisma, Supply } from '@prisma/client'

export interface SuppliesRepository {
    create(data: Prisma.SupplyCreateInput, tx?: Prisma.TransactionClient): Promise<Supply>
    findById(id: string): Promise<Supply | null>
    findByName(name: string): Promise<Supply | null>
    findMany(page: number, limit: number, query?: string, isActive?: boolean): Promise<{ items: Supply[], total: number }>
    update(id: string, data: Prisma.SupplyUpdateInput, tx?: Prisma.TransactionClient): Promise<Supply>
    delete(id: string, tx?: Prisma.TransactionClient): Promise<void>
    changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void>
}
