import { prisma } from '@/lib/prisma'
import { Item, Prisma } from '@prisma/client'
import { ItemsRepository } from '../items-repository'

export class PrismaItemsRepository implements ItemsRepository {
    async create(data: Prisma.ItemCreateInput): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean }> {
        const item = await prisma.item.create({
            data
        })
        return item
    }
    async findByName(name: string, is_active?: boolean | undefined): Promise<Item[] | null> {
        let item
        if (is_active) {
            item = await prisma.item.findMany({
                where: {
                    AND: [
                        { name: name },
                        { active: is_active }
                    ]

                }
            })
        }
        else {
            item = await prisma.item.findMany({
                where: {
                    name
                }
            })
        }

        if (item.length === 0)
            return null
        return item
    }
    async findById(id: string): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean } | null> {
        const item = await prisma.item.findFirst({
            where: {
                id
            }
        })
        return item
    }
    async findMany(is_active?: boolean | undefined, is_product?: boolean | undefined): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean }[] | null> {

        const item = await prisma.item.findMany({
            where: {
                isItem: is_product,
                active: is_active
            }
        })
        return item
    }
    update(data: Prisma.ItemUpdateInput): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean }> {
        throw new Error('Method not implemented.')
    }
    async remove(id: string): Promise<void> {
        await prisma.item.delete({
            where: {
                id
            }
        })
    }
    async changeStock(id: string, stock: number, operationType: boolean): Promise<void> {

        const findedStock = await prisma.item.findFirst({
            where: {
                id
            }
        })
        let updatedItem
        if (findedStock)
            updatedItem = await prisma.item.update({
                where: { id },
                data: {
                    stock: {
                        increment: operationType ? stock : -stock,
                    }
                }
            })
        console.log(updatedItem)
    }
    async setActive(id: string, commutator: boolean): Promise<void> {
        const findedStock = await prisma.item.findFirst({
            where: {
                id
            }
        })
        if (findedStock)
            prisma.item.update({
                where: {
                    id
                },
                data: {
                    active: commutator
                }
            })
    }

}
