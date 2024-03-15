import { ItemsRepository } from '@/repositories/items-repository'
import { Item } from '@prisma/client'


interface GetItemsUseCaseResponse {
    items: Item[] | null
}
export class GetItemsUseCase {

    constructor(
        private itemsRepository: ItemsRepository
    ) { }
    async execute(): Promise<GetItemsUseCaseResponse> {

        const items = await this.itemsRepository.findMany()


        return {
            items
        }
    }
}

