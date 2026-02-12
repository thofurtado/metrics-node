import { prisma } from '@/lib/prisma'
import { Prisma, Supplier } from '@prisma/client'
import { SuppliersRepository } from '@/modules/suppliers/repositories/suppliers-repository'

export class PrismaSuppliersRepository implements SuppliersRepository {
    async create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
        return await prisma.supplier.create({
            data,
        })
    }

    async findById(id: string): Promise<Supplier | null> {
        return await prisma.supplier.findUnique({
            where: { id },
        })
    }

    async findByName(name: string): Promise<Supplier | null> {
        return await prisma.supplier.findFirst({
            where: { name },
        })
    }

    async findMany(page: number, perPage: number, query?: string): Promise<{ suppliers: Supplier[], count: number }> {
        const [supplies, count] = await Promise.all([
            prisma.supplier.findMany({
                where: {
                    name: { contains: query, mode: 'insensitive' }
                },
                take: perPage,
                skip: (page - 1) * perPage,
            }),
            prisma.supplier.count({
                where: {
                    name: { contains: query, mode: 'insensitive' }
                }
            })
        ])
        return { suppliers: supplies, count }
    }

    async update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
        return await prisma.supplier.update({
            where: { id },
            data
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.supplier.delete({
            where: { id }
        })
    }
}
