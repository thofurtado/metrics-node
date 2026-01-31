import { Item, Prisma, ItemType } from '@prisma/client'
import { GetItemsDTO } from './DTO/get-items-dto'

export type ItemWithExtensions = Prisma.ItemGetPayload<{
    include: {
        product: true
        service: true
        supply: true
    }
}>

export interface ItemsRepository {
    create(data: Prisma.ItemCreateInput, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions>
    findByName(name: string, is_active?: boolean): Promise<ItemWithExtensions[] | null>
    findById(id: string): Promise<ItemWithExtensions | null>
    findMany(is_active?: boolean, type?: ItemType, pageIndex?: number, perPage?: number, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null>
    update(data: Prisma.ItemUpdateInput, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions>
    remove(id: string, tx?: Prisma.TransactionClient): Promise<void>
    changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient): Promise<void>
    setActive(id: string, commutator: boolean, tx?: Prisma.TransactionClient): Promise<void>
    findMaxDisplayId(type: ItemType): Promise<number>
    findNextAvailableDisplayId(type: ItemType, tx?: Prisma.TransactionClient): Promise<number>
}
