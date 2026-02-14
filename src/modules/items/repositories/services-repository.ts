import { Prisma, Service } from '@prisma/client'

export interface ServicesRepository {
    create(data: Prisma.ServiceCreateInput, tx?: Prisma.TransactionClient): Promise<Service>
    findById(id: string): Promise<Service | null>
    findByName(name: string): Promise<Service | null>
    findMany(page: number, limit: number, query?: string, displayId?: number, isActive?: boolean): Promise<{ items: Service[], total: number }>
    update(id: string, data: Prisma.ServiceUpdateInput, tx?: Prisma.TransactionClient): Promise<Service>
    delete(id: string, tx?: Prisma.TransactionClient): Promise<void>
    findNextAvailableDisplayId(tx?: Prisma.TransactionClient): Promise<number>
}
