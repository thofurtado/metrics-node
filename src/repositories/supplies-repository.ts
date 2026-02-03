import { Prisma, Supply } from '@prisma/client'

export interface SuppliesRepository {
    create(data: Prisma.SupplyCreateInput): Promise<Supply>
    findById(id: string, tx?: Prisma.TransactionClient): Promise<Supply | null>
    findByName(name: string): Promise<Supply | null>
    findMany(page: number, perPage: number, query?: string): Promise<{ supplies: Supply[], count: number }>
    save(supply: Supply, tx?: Prisma.TransactionClient): Promise<Supply>
    delete(id: string): Promise<void>
    decreaseStock(id: string, quantity: number, tx?: Prisma.TransactionClient): Promise<void>
}
