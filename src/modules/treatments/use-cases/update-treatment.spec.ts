import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateTreatmentUseCase } from './update-treatment'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

// Fase 1 do Mergulho (16:A2): mudar a situação para dentro ou para fora de "finalizada" passa pelo fechamento e pela
// reabertura (que mexem no estoque e no financeiro); o resto continua sendo só troca de texto.
class FakeTreatmentsRepository {
    public lastUpdate: any = null
    constructor(public treatment: any) {}
    async findById(_id: string) {
        return this.treatment
    }
    async update(_id: string, data: any) {
        this.lastUpdate = data
        return { ...this.treatment, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }
    }
}

const finish = { execute: vi.fn(async () => ({})) }
const reopen = { execute: vi.fn(async () => ({})) }

beforeEach(() => {
    finish.execute.mockClear()
    reopen.execute.mockClear()
})

describe('UpdateTreatmentUseCase (16:A2)', () => {
    it('cancelar uma O.S. finalizada desfaz o fechamento e grava "canceled" pela reabertura', async () => {
        const repo = new FakeTreatmentsRepository({ id: 't1', status: 'resolved' })
        const sut = new UpdateTreatmentUseCase(repo as any, finish, reopen)

        await sut.execute({ id: 't1', status: 'canceled' })

        expect(reopen.execute).toHaveBeenCalledWith({ treatment_id: 't1', nextStatus: 'canceled' })
        expect(finish.execute).not.toHaveBeenCalled()
        expect(repo.lastUpdate.status).toBeUndefined() // a situação já foi gravada pela reabertura
    })

    it('cancelar uma O.S. ainda aberta só troca a situação (nada foi baixado ainda)', async () => {
        const repo = new FakeTreatmentsRepository({ id: 't1', status: 'in_progress' })
        const sut = new UpdateTreatmentUseCase(repo as any, finish, reopen)

        await sut.execute({ id: 't1', status: 'canceled' })

        expect(reopen.execute).not.toHaveBeenCalled()
        expect(finish.execute).not.toHaveBeenCalled()
        expect(repo.lastUpdate.status).toBe('canceled')
    })

    it('marcar "resolvido" sem ter finalizado passa pelo fechamento (baixa o estoque)', async () => {
        const repo = new FakeTreatmentsRepository({ id: 't1', status: 'pending' })
        const sut = new UpdateTreatmentUseCase(repo as any, finish, reopen)

        await sut.execute({ id: 't1', status: 'resolved', ending_date: new Date() })

        expect(finish.execute).toHaveBeenCalledWith({ treatment_id: 't1' })
        expect(repo.lastUpdate.status).toBeUndefined()
    })

    it('"resolvido" de novo numa O.S. já finalizada (a web faz isso depois do fechamento) não fecha duas vezes', async () => {
        const repo = new FakeTreatmentsRepository({ id: 't1', status: 'resolved' })
        const sut = new UpdateTreatmentUseCase(repo as any, finish, reopen)

        await sut.execute({ id: 't1', status: 'resolved' })

        expect(finish.execute).not.toHaveBeenCalled()
        expect(reopen.execute).not.toHaveBeenCalled()
    })

    it('se a reabertura recusar (a prazo já pago), a situação não muda', async () => {
        const repo = new FakeTreatmentsRepository({ id: 't1', status: 'resolved' })
        const recusa = { execute: vi.fn(async () => { throw new Error('O cliente já pagou') }) }
        const sut = new UpdateTreatmentUseCase(repo as any, finish, recusa)

        await expect(sut.execute({ id: 't1', status: 'canceled' })).rejects.toThrow('já pagou')
        expect(repo.lastUpdate).toBeNull()
    })

    it('O.S. inexistente', async () => {
        const sut = new UpdateTreatmentUseCase(new FakeTreatmentsRepository(null) as any, finish, reopen)
        await expect(sut.execute({ id: 'x', status: 'canceled' })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })

    it('mudança sem situação (só observação) não consulta nem chama fechamento/reabertura', async () => {
        const repo = new FakeTreatmentsRepository({ id: 't1', status: 'resolved' })
        const sut = new UpdateTreatmentUseCase(repo as any, finish, reopen)

        await sut.execute({ id: 't1', observations: 'cliente avisado' })

        expect(repo.lastUpdate.observations).toBe('cliente avisado')
        expect(finish.execute).not.toHaveBeenCalled()
        expect(reopen.execute).not.toHaveBeenCalled()
    })
})
