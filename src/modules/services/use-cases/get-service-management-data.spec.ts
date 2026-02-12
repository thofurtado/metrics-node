// tests/get-service-management-data.spec.ts
import { expect, describe, it, beforeEach } from 'vitest'
import { GetServiceManagementDataUseCase } from '@/modules/services/use-cases/get-service-management-data'
import { InMemoryServiceManagementRepository } from '@/modules/services/repositories/in-memory/in-memory-service-management-repository'
import { Treatment } from '@prisma/client'

let serviceManagementRepository: InMemoryServiceManagementRepository
let getServiceManagementDataUseCase: GetServiceManagementDataUseCase

// Função auxiliar para adicionar tratamentos
function createTreatment(repository: InMemoryServiceManagementRepository, treatment: Partial<Treatment>) {
    const newTreatment: Treatment = {
        id: treatment.id || `treatment-${repository.items.length + 1}`,
        opening_date: treatment.opening_date || new Date(),
        ending_date: treatment.ending_date || null,
        contact: treatment.contact || null,
        user_id: treatment.user_id || null,
        client_id: treatment.client_id || null,
        equipment_id: treatment.equipment_id || null,
        request: treatment.request || 'Default request',
        status: treatment.status || 'pending',
        amount: treatment.amount || 0,
        observations: treatment.observations || null,
        ...treatment
    }

    repository.items.push(newTreatment)
    return newTreatment
}

describe('Get Service Management Data Use Case', () => {
    beforeEach(() => {
        serviceManagementRepository = new InMemoryServiceManagementRepository()
        getServiceManagementDataUseCase = new GetServiceManagementDataUseCase(serviceManagementRepository)
    })

    it('should be able to get service management data with correct calculations', async () => {
        const currentDate = new Date()

        // Atendimento finalizado (3 dias)
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 10, 0),
            ending_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 4, 10, 0), // 3 dias depois
            status: 'resolved',
            request: 'Reparo completo'
        })

        // Atendimento na bancada
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 2, 9, 0),
            status: 'in_workbench',
            request: 'Troca de peças'
        })

        // Atendimento externo em andamento
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 3, 14, 0),
            status: 'in_progress',
            request: 'Visita técnica'
        })

        // Atendimento pendente
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 4, 8, 0),
            status: 'pending',
            request: 'Aguardando aprovação'
        })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        expect(serviceData.totalTreatments).toEqual(4)
        expect(serviceData.completedTreatments).toEqual(1)
        expect(serviceData.inWorkbench).toEqual(1)
        expect(serviceData.externalOpen).toEqual(2) // in_progress + pending
        expect(serviceData.averageTreatmentTime).toBeGreaterThan(0)
    })

    it('should correctly count workbench and external treatments from all months', async () => {
        const currentDate = new Date()
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15)

        // Atendimentos deste mês
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
            status: 'resolved',
            request: 'Finalizado este mês'
        })

        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 2),
            status: 'in_workbench',
            request: 'Bancada este mês'
        })

        // Atendimentos de meses anteriores EM ABERTO (devem ser contados)
        createTreatment(serviceManagementRepository, {
            opening_date: lastMonth,
            status: 'in_workbench', // Deve contar para bancada
            request: 'Bancada mês passado'
        })

        createTreatment(serviceManagementRepository, {
            opening_date: lastMonth,
            status: 'in_progress', // Deve contar para externos
            request: 'Externo mês passado'
        })

        createTreatment(serviceManagementRepository, {
            opening_date: lastMonth,
            status: 'pending', // Deve contar para externos
            request: 'Pendente mês passado'
        })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        // Totais do mês atual
        expect(serviceData.totalTreatments).toEqual(2) // Apenas os iniciados este mês
        expect(serviceData.completedTreatments).toEqual(1) // Apenas os finalizados este mês

        // Backlog total (todos os meses)
        expect(serviceData.inWorkbench).toEqual(2) // Bancada este mês + bancada mês passado
        expect(serviceData.externalOpen).toEqual(2) // Externo mês passado + pendente mês passado
    })

    it('should be able to get service management data with no treatments', async () => {
        const { serviceData } = await getServiceManagementDataUseCase.execute()

        expect(serviceData.totalTreatments).toEqual(0)
        expect(serviceData.completedTreatments).toEqual(0)
        expect(serviceData.inWorkbench).toEqual(0)
        expect(serviceData.externalOpen).toEqual(0)
        expect(serviceData.averageTreatmentTime).toEqual(0)
    })

    it('should correctly calculate average time for completed treatments', async () => {
        const currentDate = new Date()

        // Atendimento de 2 dias
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getTime() - (2 * 24 * 60 * 60 * 1000)), // 2 dias atrás
            ending_date: new Date(currentDate.getTime() - (1 * 24 * 60 * 60 * 1000)), // 1 dia atrás
            status: 'resolved',
            request: 'Reparo rápido'
        })

        // Atendimento de 1 dia
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getTime() - (3 * 24 * 60 * 60 * 1000)), // 3 dias atrás
            ending_date: new Date(currentDate.getTime() - (2 * 24 * 60 * 60 * 1000)), // 2 dias atrás
            status: 'resolved',
            request: 'Manutenção preventiva'
        })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        // Média de 1.5 dias em minutos (36 horas = 2160 minutos)
        expect(serviceData.averageTreatmentTime).toBeCloseTo(2160, -2) // Aproximadamente 2160 minutos
    })

    it('should correctly identify external open treatments', async () => {
        const currentDate = new Date()

        // Status que contam como externos abertos
        createTreatment(serviceManagementRepository, { status: 'pending', opening_date: currentDate, request: 'Test 1' })
        createTreatment(serviceManagementRepository, { status: 'in_progress', opening_date: currentDate, request: 'Test 2' })
        createTreatment(serviceManagementRepository, { status: 'follow_up', opening_date: currentDate, request: 'Test 3' })

        // Status que NÃO contam como externos abertos
        createTreatment(serviceManagementRepository, { status: 'resolved', opening_date: currentDate, request: 'Test 4' })
        createTreatment(serviceManagementRepository, { status: 'in_workbench', opening_date: currentDate, request: 'Test 5' })
        createTreatment(serviceManagementRepository, { status: 'canceled', opening_date: currentDate, request: 'Test 6' })
        createTreatment(serviceManagementRepository, { status: 'on_hold', opening_date: currentDate, request: 'Test 7' })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        expect(serviceData.externalOpen).toEqual(3) // pending, in_progress, follow_up
        expect(serviceData.totalTreatments).toEqual(7)
    })

    it('should include open treatments in average time calculation', async () => {
        const currentDate = new Date()
        const twoDaysAgo = new Date(currentDate.getTime() - (2 * 24 * 60 * 60 * 1000))

        // Atendimento em aberto há 2 dias
        createTreatment(serviceManagementRepository, {
            opening_date: twoDaysAgo,
            status: 'in_progress',
            request: 'Reparo demorado'
        })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        // Deve ter aproximadamente 2880 minutos (2 dias)
        expect(serviceData.averageTreatmentTime).toBeCloseTo(2880, -2)
    })

    it('should calculate average time only for current month treatments', async () => {
        const currentDate = new Date()
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15)

        // Atendimento do mês passado (NÃO deve entrar no cálculo da média)
        createTreatment(serviceManagementRepository, {
            opening_date: lastMonth,
            status: 'in_progress',
            request: 'Antigo'
        })

        // Atendimento deste mês (DEVE entrar no cálculo da média)
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
            status: 'in_progress',
            request: 'Atual'
        })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        // A média deve ser calculada apenas com o atendimento deste mês
        expect(serviceData.totalTreatments).toEqual(1)
        expect(serviceData.averageTreatmentTime).toBeGreaterThan(0)
    })

    it('should count all treatments resolved this month regardless of when they started', async () => {
        const currentDate = new Date()
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15)
        const twoMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 10)

        // Atendimento iniciado mês passado e finalizado este mês (DEVE contar como concluído)
        createTreatment(serviceManagementRepository, {
            opening_date: lastMonth,
            ending_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 5), // Finalizado este mês
            status: 'resolved',
            request: 'Finalizado este mês - começou mês passado'
        })

        // Atendimento iniciado e finalizado este mês (DEVE contar como concluído)
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
            ending_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 3),
            status: 'resolved',
            request: 'Iniciado e finalizado este mês'
        })

        // Atendimento iniciado há 2 meses e finalizado este mês (DEVE contar como concluído)
        createTreatment(serviceManagementRepository, {
            opening_date: twoMonthsAgo,
            ending_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 10), // Finalizado este mês
            status: 'resolved',
            request: 'Finalizado este mês - começou há 2 meses'
        })

        // Atendimento finalizado mês passado (NÃO deve contar)
        createTreatment(serviceManagementRepository, {
            opening_date: twoMonthsAgo,
            ending_date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15), // Finalizado mês passado
            status: 'resolved',
            request: 'Finalizado mês passado'
        })

        // Atendimento em aberto (NÃO deve contar)
        createTreatment(serviceManagementRepository, {
            opening_date: lastMonth,
            status: 'in_progress', // Ainda em aberto
            request: 'Ainda em andamento'
        })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        // Total iniciados este mês: apenas 1
        expect(serviceData.totalTreatments).toEqual(1)

        // Concluídos este mês: 3 (todos os que foram resolvidos este mês, independente de quando começaram)
        expect(serviceData.completedTreatments).toEqual(3)

        // Bancada: 0 (nenhum com status in_workbench)
        expect(serviceData.inWorkbench).toEqual(0)

        // Externos: 1 (apenas o que está em andamento)
        expect(serviceData.externalOpen).toEqual(1)
    })

    it('should not count treatments without ending_date as completed', async () => {
        const currentDate = new Date()

        // Atendimento resolvido mas sem ending_date (NÃO deve contar)
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
            status: 'resolved',
            // ending_date: null (implícito)
            request: 'Resolvido sem data'
        })

        // Atendimento resolvido com ending_date (DEVE contar)
        createTreatment(serviceManagementRepository, {
            opening_date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
            ending_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 5),
            status: 'resolved',
            request: 'Resolvido com data'
        })

        const { serviceData } = await getServiceManagementDataUseCase.execute()

        // Concluídos: apenas 1 (o que tem ending_date)
        expect(serviceData.completedTreatments).toEqual(1)
    })
})