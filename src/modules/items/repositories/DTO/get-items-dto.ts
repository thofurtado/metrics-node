import { ItemWithExtensions } from '@/modules/items/repositories/items-repository'

export interface GetItemsDTO {
    items: ItemWithExtensions[],
    meta: {
        totalCount: number,
        perPage: number,
        pageIndex: number
    }
}
