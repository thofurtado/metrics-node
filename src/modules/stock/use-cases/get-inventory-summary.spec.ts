// tests/get-inventory-summary.spec.ts
import { expect, describe, it, beforeEach } from 'vitest'
import { GetInventorySummaryUseCase } from '@/modules/stock/use-cases/get-inventory-summary'
import { InMemoryInventoryRepository } from '@/modules/stock/repositories/in-memory/in-memory-inventory-repository'

let inventoryRepository: InMemoryInventoryRepository
let getInventorySummaryUseCase: GetInventorySummaryUseCase

describe('Get Inventory Summary Use Case', () => {
    beforeEach(() => {
        inventoryRepository = new InMemoryInventoryRepository()
        getInventorySummaryUseCase = new GetInventorySummaryUseCase(inventoryRepository)
    })

    it('should be able to get inventory summary with correct value calculations', async () => {
        const currentDate = new Date()

        // Criar produtos (isItem = true) para patrimônio
        const product1 = inventoryRepository.createItem({
            name: 'Produto A',
            cost: 50,
            stock: 10, // Patrimônio: 50 * 10 = 500
            isItem: true
        })

        const product2 = inventoryRepository.createItem({
            name: 'Produto B',
            cost: 100,
            stock: 5, // Patrimônio: 100 * 5 = 500
            isItem: true
        })

        // Criar serviço (isItem = false) - NÃO entra no patrimônio
        const service1 = inventoryRepository.createItem({
            name: 'Serviço C',
            cost: 0,
            stock: 0,
            isItem: false
        })

        // Criar tratamento deste mês
        const treatment = inventoryRepository.createTreatment({
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        })

        // Produtos vendidos este mês
        inventoryRepository.createTreatmentItem({
            treatment_id: treatment.id,
            item_id: product1.id,
            quantity: 2,
            salesValue: 80 // Valor: 2 * 80 = 160
        })

        inventoryRepository.createTreatmentItem({
            treatment_id: treatment.id,
            item_id: product2.id,
            quantity: 1,
            salesValue: 150 // Valor: 1 * 150 = 150
        })

        // Serviços vendidos este mês
        inventoryRepository.createTreatmentItem({
            treatment_id: treatment.id,
            item_id: service1.id,
            quantity: 1,
            salesValue: 200 // Valor: 1 * 200 = 200
        })

        const { inventorySummary } = await getInventorySummaryUseCase.execute()

        expect(inventorySummary.patrimony).toEqual(1000) // 500 + 500
        expect(inventorySummary.productsSold).toEqual(310) // 160 + 150
        expect(inventorySummary.servicesSold).toEqual(200) // 200
    })

    it('should calculate patrimony only for active items with isItem true', async () => {
        // Produto ativo - deve contar
        inventoryRepository.createItem({
            name: 'Produto Ativo',
            cost: 100,
            stock: 5, // 100 * 5 = 500
            isItem: true,
            active: true
        })

        // Produto inativo - NÃO deve contar
        inventoryRepository.createItem({
            name: 'Produto Inativo',
            cost: 50,
            stock: 10, // 50 * 10 = 500 (mas não conta)
            isItem: true,
            active: false
        })

        // Serviço - NÃO deve contar no patrimônio
        inventoryRepository.createItem({
            name: 'Serviço',
            cost: 200,
            stock: 1, // 200 * 1 = 200 (mas não conta)
            isItem: false,
            active: true
        })

        const { inventorySummary } = await getInventorySummaryUseCase.execute()

        expect(inventorySummary.patrimony).toEqual(500) // Apenas o produto ativo
    })

    it('should only count treatment items from current month', async () => {
        const currentDate = new Date()
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15)

        // Criar produto
        const product = inventoryRepository.createItem({
            name: 'Produto Teste',
            cost: 50,
            stock: 10,
            isItem: true
        })

        // Tratamento deste mês (DEVE contar)
        const currentMonthTreatment = inventoryRepository.createTreatment({
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 5)
        })

        // Tratamento do mês passado (NÃO deve contar)
        const lastMonthTreatment = inventoryRepository.createTreatment({
            opening_date: lastMonth
        })

        // Venda deste mês
        inventoryRepository.createTreatmentItem({
            treatment_id: currentMonthTreatment.id,
            item_id: product.id,
            quantity: 3,
            salesValue: 100 // Valor: 3 * 100 = 300
        })

        // Venda do mês passado
        inventoryRepository.createTreatmentItem({
            treatment_id: lastMonthTreatment.id,
            item_id: product.id,
            quantity: 2,
            salesValue: 100 // Valor: 2 * 100 = 200 (não conta)
        })

        const { inventorySummary } = await getInventorySummaryUseCase.execute()

        expect(inventorySummary.productsSold).toEqual(300) // Apenas a venda deste mês
    })

    it('should handle items without salesValue (use price as fallback)', async () => {
        const currentDate = new Date()

        const product = inventoryRepository.createItem({
            name: 'Produto sem SalesValue',
            cost: 30,
            stock: 5,
            price: 80, // Será usado como fallback
            isItem: true
        })

        const treatment = inventoryRepository.createTreatment({
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        })

        // TreatmentItem sem salesValue definido
        inventoryRepository.createTreatmentItem({
            treatment_id: treatment.id,
            item_id: product.id,
            quantity: 2
            // salesValue: null (usa o price do item como fallback)
        })

        const { inventorySummary } = await getInventorySummaryUseCase.execute()

        expect(inventorySummary.productsSold).toEqual(160) // 2 * 80 (price do item)
    })

    it('should return zero values when no data exists', async () => {
        const { inventorySummary } = await getInventorySummaryUseCase.execute()

        expect(inventorySummary.patrimony).toEqual(0)
        expect(inventorySummary.productsSold).toEqual(0)
        expect(inventorySummary.servicesSold).toEqual(0)
    })

    it('should correctly separate products and services sales', async () => {
        const currentDate = new Date()

        const product = inventoryRepository.createItem({
            name: 'Produto',
            isItem: true
        })

        const service = inventoryRepository.createItem({
            name: 'Serviço',
            isItem: false
        })

        const treatment = inventoryRepository.createTreatment({
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        })

        // Venda de produto
        inventoryRepository.createTreatmentItem({
            treatment_id: treatment.id,
            item_id: product.id,
            quantity: 2,
            salesValue: 50 // Produtos: 2 * 50 = 100
        })

        // Venda de serviço
        inventoryRepository.createTreatmentItem({
            treatment_id: treatment.id,
            item_id: service.id,
            quantity: 1,
            salesValue: 150 // Serviços: 1 * 150 = 150
        })

        const { inventorySummary } = await getInventorySummaryUseCase.execute()

        expect(inventorySummary.productsSold).toEqual(100)
        expect(inventorySummary.servicesSold).toEqual(150)
    })
})