import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FinishTreatmentUseCase } from './finish-treatment'

// Fase 1 do Mergulho (16:A3): o a prazo da O.S. vai para a conta do cliente (client_tabs), não para uma receita pendente.
// O fechamento só usa o caminho com `tx` (prisma.$transaction) quando o repositório não é "InMemory": por isso o fake.
class FakeTreatmentsRepository {
    constructor(public treatment: any) {}
    async findById(_id: string) {
        return this.treatment
    }
    async close(_id: string) {
        this.treatment.status = 'resolved'
        return this.treatment
    }
}

const formas: Record<string, any> = {
    prazo: { id: 'prazo', name: 'A Prazo (Correntista)', in_sight: false, account_id: null },
    pix: { id: 'pix', name: 'Pix', in_sight: true, account_id: 'conta-1' },
}

let contasCriadas: any[] = []
let receitasCriadas: any[] = []

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: async (cb: any) => cb({
            payment: { findUnique: async ({ where }: any) => formas[where.id] ?? null },
            account: { findFirst: async () => ({ id: 'conta-padrao' }) },
            clientTab: { create: async ({ data }: any) => { contasCriadas.push(data); return { id: 'tab-1', ...data } } },
            transaction: { create: async ({ data }: any) => { receitasCriadas.push(data); return { id: `tx-${receitasCriadas.length}`, ...data } } },
            treatmentTransaction: { create: async () => ({}) },
            stock: { create: async () => ({}) },
        }),
    },
}))

const paymentEntrys = { findByTreatment: async () => [] }
const accounts = { changeBalance: vi.fn(async () => ({})) }

function makeSut(treatment: any) {
    return new FinishTreatmentUseCase(new FakeTreatmentsRepository(treatment) as any, paymentEntrys as any, {} as any, accounts as any, null, null)
}

beforeEach(() => {
    contasCriadas = []
    receitasCriadas = []
    accounts.changeBalance.mockClear()
})

describe('Fechamento de O.S. com pagamento a prazo (16:A3)', () => {
    it('o a prazo vira conta do cliente com a marca da O.S. e não vira receita pendente', async () => {
        const sut = makeSut({ id: 'abcdef12-0000-0000-0000-000000000000', status: 'pending', amount: 300, client_id: 'cli-1', clients: { name: 'Maria' }, items: [] })

        await sut.execute({
            treatment_id: 'abcdef12-0000-0000-0000-000000000000',
            payments: [{ payment_id: 'prazo', amount: 300, occurrences: 1, is_paid: true }],
        })

        expect(contasCriadas).toEqual([{
            client_id: 'cli-1',
            amount: 300,
            description: 'Atendimento a Prazo - O.S #abcdef12 (Maria)',
            is_paid: false,
        }])
        expect(receitasCriadas).toHaveLength(0)
        expect(accounts.changeBalance).not.toHaveBeenCalled()
    })

    it('pagamento misto: o Pix entra no caixa e só a parte a prazo vai para a conta do cliente', async () => {
        const sut = makeSut({ id: 'abcdef12-0000-0000-0000-000000000000', status: 'pending', amount: 300, client_id: 'cli-1', clients: { name: 'Maria' }, items: [] })

        await sut.execute({
            treatment_id: 'abcdef12-0000-0000-0000-000000000000',
            payments: [
                { payment_id: 'pix', amount: 100, occurrences: 1, is_paid: true },
                { payment_id: 'prazo', amount: 200, occurrences: 1 },
            ],
        })

        expect(receitasCriadas).toHaveLength(1)
        expect(receitasCriadas[0]).toMatchObject({ amount: 100, confirmed: true, totalValue: 100 })
        expect(contasCriadas).toHaveLength(1)
        expect(contasCriadas[0]).toMatchObject({ client_id: 'cli-1', amount: 200 })
    })

    it('a prazo sem cliente na O.S. para com um aviso claro', async () => {
        const sut = makeSut({ id: 'abcdef12-0000-0000-0000-000000000000', status: 'pending', amount: 50, client_id: null, items: [] })

        await expect(sut.execute({
            treatment_id: 'abcdef12-0000-0000-0000-000000000000',
            payments: [{ payment_id: 'prazo', amount: 50, occurrences: 1 }],
        })).rejects.toThrow('precisa de um cliente')
        expect(contasCriadas).toHaveLength(0)
    })
})
