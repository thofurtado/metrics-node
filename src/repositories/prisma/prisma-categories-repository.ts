import { prisma } from '@/lib/prisma'
import { CategoriesRepository } from '@/repositories/categories-repository'
import { Prisma, Category } from '@prisma/client'

export class PrismaCategoriesRepository implements CategoriesRepository {
    async create(data: Prisma.CategoryCreateInput): Promise<Category> {
        return prisma.category.create({
            data,
        })
    }

    async findByName(name: string): Promise<Category | null> {
        return prisma.category.findUnique({
            where: {
                name,
            },
        })
    }

    async findMany(): Promise<Category[]> {
        return prisma.category.findMany()
    }
}
