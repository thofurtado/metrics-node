import { Prisma, Sale } from '@prisma/client'

export interface SalesRepository {
    create(data: Prisma.SaleUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Sale>
    findById(id: string): Promise<Sale | null>
    list(pageIndex?: number, perPage?: number): Promise<{ sales: Sale[], totalCount: number }>
}
