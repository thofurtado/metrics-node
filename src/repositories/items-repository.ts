import { Item, Prisma } from '@prisma/client'
import { GetItemsDTO } from './DTO/get-items-dto'
export interface ItemsRepository {
    create(data: Prisma.ItemCreateInput, tx?: Prisma.TransactionClient): Promise<Item>
    findByName(name: string, is_active?: boolean): Promise<Item[] | null>
    findById(id: string): Promise<Item | null>
    findMany(is_active?: boolean, is_product?: boolean, pageIndex?: number, perPage?: number, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null>
    update(data: Prisma.ItemUpdateInput, tx?: Prisma.TransactionClient): Promise<Item>
    remove(id: string, tx?: Prisma.TransactionClient): Promise<void> //only can be deleted if there is no other relation with this item stock, treatment
    changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient): Promise<void>
    setActive(id: string, commutator: boolean, tx?: Prisma.TransactionClient): Promise<void>
    findMaxDisplayId(): Promise<number>
    findNextAvailableDisplayId(): Promise<number>
}
