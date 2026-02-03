import { prisma } from '@/lib/prisma'
import { Prisma, Product } from '@prisma/client'
import { ProductsRepository } from '../products-repository'
import { ResourceDependencyError } from '@/use-cases/errors/resource-dependency-error'

export class PrismaProductsRepository implements ProductsRepository {
    async create(data: Prisma.ProductCreateInput): Promise<Product> {
        return await prisma.product.create({
            data,
        })
    }

    async findById(id: string): Promise<Product | null> {
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                compositions: {
                    include: {
                        supply: true
                    }
                },
                category: true
            }
        })

        if (product && product.is_composite && product.compositions.length > 0) {
            const calculatedCost = product.compositions.reduce((acc, comp) => {
                return acc + (comp.quantity * (comp.supply.cost || 0))
            }, 0)
            return { ...product, cost: calculatedCost }
        }

        return product
    }

    async findByName(name: string): Promise<Product | null> {
        return await prisma.product.findFirst({
            where: { name },
        })
    }

    async findByDisplayId(displayId: number): Promise<Product | null> {
        return await prisma.product.findUnique({
            where: { display_id: displayId },
        })
    }

    async findMany(page: number, perPage: number, query?: string, active?: boolean): Promise<{ products: Product[], count: number }> {
        const where: Prisma.ProductWhereInput = {
            name: { contains: query, mode: 'insensitive' }
        }

        if (active !== undefined) {
            where.active = active
        }

        const [products, count] = await Promise.all([
            prisma.product.findMany({
                where,
                take: perPage,
                skip: (page - 1) * perPage,
                orderBy: { display_id: 'desc' },
                include: {
                    compositions: {
                        include: {
                            supply: true
                        }
                    },
                    category: true
                }
            }),
            prisma.product.count({
                where
            })
        ])
        const productsWithCalculatedCost = products.map(product => {
            if (product.is_composite && product.compositions.length > 0) {
                const calculatedCost = product.compositions.reduce((acc, comp) => {
                    return acc + (comp.quantity * (comp.supply.cost || 0))
                }, 0)
                return { ...product, cost: calculatedCost }
            }
            return product
        })

        return { products: productsWithCalculatedCost, count }
    }

    async save(product: Product, tx?: Prisma.TransactionClient): Promise<Product> {
        const { id, ...data } = product as any
        const { compositions, stocks, treatmentItems, created_at, updated_at, category, ...cleanData } = data

        const client = tx || prisma

        return await client.product.update({
            where: { id },
            data: {
                ...cleanData,
                compositions: compositions ? {
                    deleteMany: {},
                    create: compositions.map((comp: any) => ({
                        quantity: comp.quantity,
                        supply_id: comp.supply_id || comp.supply?.id
                    }))
                } : undefined
            },
        })
    }

    async delete(id: string): Promise<void> {
        try {
            await prisma.product.delete({
                where: { id }
            })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new ResourceDependencyError()
            }
            throw error
        }
    }

    async decreaseStock(id: string, quantity: number, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx || prisma
        await client.product.update({
            where: { id },
            data: {
                stock: {
                    decrement: quantity
                }
            }
        })
    }

    async findManyBySupplyId(supplyId: string, tx?: Prisma.TransactionClient): Promise<Product[]> {
        const client = tx || prisma
        return await client.product.findMany({
            where: {
                compositions: {
                    some: {
                        supply_id: supplyId
                    }
                }
            },
            include: {
                compositions: {
                    include: {
                        supply: true
                    }
                }
            }
        })
    }

    async findNextAvailableDisplayId(): Promise<number> {
        const last = await prisma.product.findFirst({
            orderBy: {
                display_id: 'desc'
            }
        })
        return (last?.display_id ?? 0) + 1
    }
}
