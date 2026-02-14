import { Prisma, Product, Service, Supply, Composition } from '@prisma/client'
import { GetItemsDTO } from '@/modules/items/repositories/DTO/get-items-dto'

// Define ItemType manually since enum is gone
export type ItemType = 'PRODUCT' | 'SERVICE' | 'SUPPLY'

// Define a unified Item structure
export type ItemWithExtensions = {
    id: string
    name: string
    description: string | null
    category: string | null
    active: boolean | null
    created_at: Date
    updated_at: Date
    type: ItemType

    // Extensions
    product: (Product & { compositions: (Composition & { supply: Supply })[] }) | null
    service: Service | null
    supply: Supply | null
}

// Union of Create Inputs
export type ItemCreateInput = (
    | ({ type: 'PRODUCT' } & Prisma.ProductCreateInput)
    | ({ type: 'SERVICE' } & Prisma.ServiceCreateInput)
    | ({ type: 'SUPPLY' } & Prisma.SupplyCreateInput)
) & { name: string, description?: string, category?: string, active?: boolean }

// Union of Update Inputs
export type ItemUpdateInput = {
    id: string
    type: ItemType
} & Partial<Prisma.ProductUpdateInput & Prisma.ServiceUpdateInput & Prisma.SupplyUpdateInput>


export interface ItemsRepository {
    create(data: any, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions>
    findByName(name: string, is_active?: boolean): Promise<ItemWithExtensions[] | null>
    findById(id: string): Promise<ItemWithExtensions | null>
    findMany(is_active?: boolean, type?: ItemType | ItemType[], pageIndex?: number, perPage?: number, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null>
    update(data: any, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions>
    remove(id: string, tx?: Prisma.TransactionClient): Promise<void>
    changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void>
    setActive(id: string, commutator: boolean, tx?: Prisma.TransactionClient): Promise<void>
    findMaxDisplayId(type: ItemType): Promise<number>
    findNextAvailableDisplayId(type: ItemType, tx?: Prisma.TransactionClient): Promise<number>
}
