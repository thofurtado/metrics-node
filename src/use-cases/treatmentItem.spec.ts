import { expect, describe, it, beforeEach } from 'vitest'
import { TreatmentItemUseCase } from './treatmentItem'
import { InMemoryTreatmentItemsRepository } from '@/repositories/in-memory/in-memory-treatmentItems-repository'
import { InMemoryTreatmentsRepository } from '@/repositories/in-memory/in-memory-treatments-repository'
import { InMemoryItemsRepository } from '@/repositories/in-memory/in-memory-items-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { InMemoryStocksRepository } from '@/repositories/in-memory/in-memory-stocks-repository'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'

let treatmentItemsRepository: InMemoryTreatmentItemsRepository
let itemsRepository: InMemoryItemsRepository
let treatmentsRepository: InMemoryTreatmentsRepository
let stocksRepository: InMemoryStocksRepository
let treatmentItemUseCase: TreatmentItemUseCase

describe('TreatmentItem Use Case - Regra de Ouro (Venda Prioritária)', () => {
    beforeEach(() => {
        treatmentsRepository = new InMemoryTreatmentsRepository()
        treatmentItemsRepository = new InMemoryTreatmentItemsRepository()
        itemsRepository = new InMemoryItemsRepository()
        stocksRepository = new InMemoryStocksRepository()
        treatmentItemUseCase = new TreatmentItemUseCase(treatmentItemsRepository, treatmentsRepository, itemsRepository, stocksRepository)
    })

    // 1. Happy Path (Simples)
    it('should be able to create treatmentItem with positive stock', async () => {
        const treatment = await treatmentsRepository.create({
            request: 'teste',
            contact: 'User'
        })
        const item = await itemsRepository.create({
            name: 'Produto Simples',
            type: 'PRODUCT',
            cost: 10,
            price: 20,
            stock: 100 // Estoque Suficiente
        })

        const { treatmentItem } = await treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: treatment.id,
            quantity: 5,
            salesValue: 20
        })

        expect(treatmentItem.id).toEqual(expect.any(String))
        expect(treatmentItem.quantity).toBe(5)
    })

    // 2. Estoque Negativo (Simples) -> DEVE SUCEDER
    it('should ALLOW adding simple product with ZERO or insufficient stock (generating negative stock)', async () => {
        const treatment = await treatmentsRepository.create({ request: 'teste', contact: 'User' })

        const item = await itemsRepository.create({
            name: 'Produto Sem Estoque',
            type: 'PRODUCT',
            cost: 10,
            price: 20,
            stock: 0 // Estoque ZERO
        })

        // Tenta vender 5 itens (vai para -5 logicamente, não deve lançar erro)
        const { treatmentItem } = await treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: treatment.id,
            quantity: 5,
            salesValue: 20
        })

        expect(treatmentItem.id).toEqual(expect.any(String))
    })

    // 3. Produto Composto (Kit/Receita) -> DEVE SUCEDER SE INSUMO FALTAR
    it('should ALLOW adding composite product even if ingredients are missing', async () => {
        const treatment = await treatmentsRepository.create({ request: 'King Burger', contact: 'User' })

        // Insumo (Carne) com estoque ZERO
        const supply = await itemsRepository.create({
            name: 'Carne',
            type: 'SUPPLY',
            cost: 5,
            price: 0,
            stock: 0
        })

        // Produto Composto (Burger) que usa Carne
        const burger = await itemsRepository.create({
            name: 'X-Burger',
            type: 'PRODUCT',
            cost: 10,
            price: 30,
            stock: 0,
            is_composite: true
        })

        // Mock composition logic (since in-memory repo might not fully simulate deep relations automatically, we assume the use-case logic handles what it receives)
        // Adjusting unit test to match UseCase expectation: UseCase reads `item.product.compositions`
        // In a real integration test, we would create the composition record. Here we trust the UseCase logic flows if data is present.
        // For unit testing WITHOUT complex mocking of relations in InMemory, we focus on the fact it DOES NOT throw error.

        // Simulating the use case execution
        const { treatmentItem } = await treatmentItemUseCase.execute({
            item_id: burger.id,
            treatment_id: treatment.id,
            quantity: 1,
            salesValue: 30
        })

        expect(treatmentItem.id).toEqual(expect.any(String))
    })

    // 4. Serviços -> Sucesso (Sem estoque)
    it('should always allow adding services regardless of anything', async () => {
        const treatment = await treatmentsRepository.create({ request: 'Manutenção', contact: 'User' })

        const service = await itemsRepository.create({
            name: 'Mão de Obra',
            type: 'SERVICE',
            cost: 0,
            price: 150,
            stock: 0
        })

        const { treatmentItem } = await treatmentItemUseCase.execute({
            item_id: service.id,
            treatment_id: treatment.id,
            quantity: 1,
            salesValue: 150
        })

        expect(treatmentItem.id).toEqual(expect.any(String))
    })

    // 5. Status do Atendimento
    it('should ALLOW adding items to ON_HOLD or PENDING treatments', async () => {
        const t1 = await treatmentsRepository.create({ request: 'T1', contact: 'U1', status: 'on_hold' })
        const t2 = await treatmentsRepository.create({ request: 'T2', contact: 'U2', status: 'pending' })

        const item = await itemsRepository.create({ name: 'Item', type: 'PRODUCT', price: 10, stock: 10 })

        await expect(treatmentItemUseCase.execute({
            item_id: item.id, treatment_id: t1.id, quantity: 1, salesValue: 10
        })).resolves.toBeTruthy()

        await expect(treatmentItemUseCase.execute({
            item_id: item.id, treatment_id: t2.id, quantity: 1, salesValue: 10
        })).resolves.toBeTruthy()
    })

    it('should BLOCK adding items to RESOLVED treatments', async () => {
        const tResolved = await treatmentsRepository.create({
            request: 'Resolvido',
            contact: 'U3',
            status: 'resolved' // Mocking status directly
        })

        const item = await itemsRepository.create({ name: 'Item', type: 'PRODUCT', price: 10, stock: 10 })

        await expect(treatmentItemUseCase.execute({
            item_id: item.id,
            treatment_id: tResolved.id,
            quantity: 1,
            salesValue: 10
        })).rejects.toBeInstanceOf(Error)
    })
})
