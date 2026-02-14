import { Prisma, Product, Composition, Supply } from '@prisma/client'

export type ProductWithCompositions = Product & {
    compositions: (Composition & { supply: Supply })[]
}

export interface ProductsRepository {
    create(data: Prisma.ProductCreateInput, tx?: Prisma.TransactionClient): Promise<Product>
    findById(id: string): Promise<ProductWithCompositions | null>
    findByName(name: string): Promise<Product | null>
    findMany(page: number, limit: number, query?: string, displayId?: number, isActive?: boolean, belowMinStock?: boolean): Promise<{ items: Product[], total: number }>
    update(id: string, data: Prisma.ProductUpdateInput, tx?: Prisma.TransactionClient): Promise<Product>
    delete(id: string, tx?: Prisma.TransactionClient): Promise<void>
    findNextAvailableDisplayId(tx?: Prisma.TransactionClient): Promise<number>
    changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void>
}
