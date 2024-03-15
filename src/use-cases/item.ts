import { ItemsRepository } from '@/repositories/items-repository'
import { Item } from '@prisma/client'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import { StocksRepository } from '@/repositories/stocks-repository'
import { PriceCannotBeLowerThanCost } from './errors/price-cannot-be-lower-than-cost-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'

interface ItemUseCaseRequest {
    name: string,
    description?: string,
    cost: number,
    price: number,
    stock?: number,
    active?: boolean,
    isItem?: boolean
}
interface ItemUseCaseResponse {
    item: Item
}
export class ItemUseCase {

    constructor(
        private itemsRepository: ItemsRepository,
        private stockRepository: StocksRepository
    ) { }
    async execute({
        name, description, cost, price, stock, active, isItem
    }: ItemUseCaseRequest): Promise<ItemUseCaseResponse> {

        const existentName = await this.itemsRepository.findByName(name)

        console.log(existentName)

        if (existentName) {
            throw new ThisNameAlreadyExistsError()
        }

        if (price < cost)
            throw new PriceCannotBeLowerThanCost()


        if (cost < 0 || price < 0)
            throw new OnlyNaturalNumbersError()
        if (stock) {
            if (stock < 0)
                throw new OnlyNaturalNumbersError()

            const item = await this.itemsRepository.create({
                name, description, cost, price, stock, active, isItem
            })
            if (stock !== 0)
                this.stockRepository.create({
                    item_id: item.id,
                    quantity: stock,
                    operation: 'input',
                    description: 'Cadastro Inicial',
                    created_at: new Date()
                })
            return {
                item
            }
        }
        const item = await this.itemsRepository.create({
            name, description, cost, price, stock: 0, active, isItem
        })
        return {
            item
        }
    }
}

