import { Prisma, Supplier } from '@prisma/client'

export interface SuppliersRepository {
    create(data: Prisma.SupplierCreateInput): Promise<Supplier>
    findById(id: string): Promise<Supplier | null>
    findByName(name: string): Promise<Supplier | null>
    update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier>
    delete(id: string): Promise<void>
}
