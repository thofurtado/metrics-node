import { Prisma, Product } from '@prisma/client'

export interface ProductsRepository {
    create(data: Prisma.ProductCreateInput): Promise<Product>
    findById(id: string): Promise<Product | null>
    findByName(name: string): Promise<Product | null>
    findByDisplayId(displayId: number): Promise<Product | null>
    findMany(page: number, perPage: number, query?: string, active?: boolean): Promise<{ products: Product[], count: number }>
    save(product: Product, tx?: Prisma.TransactionClient): Promise<Product>
    delete(id: string): Promise<void>
    decreaseStock(id: string, quantity: number, tx?: Prisma.TransactionClient): Promise<void>
    findManyBySupplyId(supplyId: string, tx?: Prisma.TransactionClient): Promise<Product[]>
    findNextAvailableDisplayId(): Promise<number>
}
