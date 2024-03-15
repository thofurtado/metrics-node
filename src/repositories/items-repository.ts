import { Item, Prisma } from '@prisma/client'

export interface ItemsRepository {
    create(data: Prisma.ItemCreateInput):Promise<Item>
    findByName(name:string, is_active?:boolean):Promise<Item[] | null>
    findById(id:string):Promise<Item | null>
    findMany(is_active?: boolean, is_product?: boolean):Promise<Item[] | null>
    update(data: Prisma.ItemUpdateInput):Promise<Item>
    remove(id:string):Promise<void> //only can be deleted if there is no other relation with this item stock, treatment
    changeStock(id:string, stock: number):Promise<void>
    setActive(id:string, commutator:boolean):Promise<void>
}
