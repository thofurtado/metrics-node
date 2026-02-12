import { Item } from '@prisma/client'

export interface GetItemsDTO {
    items: Item[],
    meta: {
        totalCount: number,
        perPage: number,
        pageIndex: number
    }
}
