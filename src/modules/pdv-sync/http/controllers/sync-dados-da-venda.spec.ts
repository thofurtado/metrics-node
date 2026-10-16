import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'

// Vendas, etapa 1 (16/10/2026): o PDV manda o nome como vendido, o vendedor, os complementos e a observação de cada item e a
// NFC-e da venda; a nota que muda depois chega pela venda reenviada ou pela rota própria. Banco simulado.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { postSalesSync } from './sales-sync-controller'
import { postSalesFiscalSync } from './sales-fiscal-sync-controller'
import {
    camposDaNota,
    camposDoItem,
    camposQueFaltam,
    complementosParaGuardar,
    ondeGravarANota,
} from '../../services/dados-da-venda'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

function zerar() {
    for (const k of Object.keys(db)) delete db[k]
}

const CAIXA = '33333333-3333-4333-8333-333333333333'
const VENDA = '44444444-4444-4444-8444-444444444442'
const ITEM = '77777777-7777-4777-8777-777777777771'
const USUARIO_ANA = '88888888-8888-4888-8888-888888888881'
const FUNCIONARIA_ANA = '99999999-9999-4999-8999-999999999991'

const NOTA = {
    Situacao: 'AUTORIZADA', Numero: 123, Serie: 2, Ambiente: 'P',
    Chave: '35261012345678000199650020000001231000001234', Contingencia: false, AlteradaEm: '2026-10-16T15:00:00.000Z',
}

describe('regras dos dados da venda', () => {
    it('a nota vira as colunas da venda (número e série zerados = vazios, situação em maiúsculas)', () => {
        expect(camposDaNota({ ...NOTA, Situacao: 'autorizada' })).toEqual({
            nfce_status: 'AUTORIZADA', nfce_number: 123, nfce_series: 2, nfce_environment: 'P', nfce_key: NOTA.Chave,
            nfce_contingency: false, nfce_reason: null, nfce_changed_at: new Date('2026-10-16T15:00:00.000Z'),
        })
        expect(camposDaNota({ Situacao: 'SEM_NOTA', Numero: 0, Serie: 0, AlteradaEm: 'não é data' })).toMatchObject({
            nfce_status: 'SEM_NOTA', nfce_number: null, nfce_series: null, nfce_key: null, nfce_changed_at: null,
        })
    })

    it('a mudança mais velha nunca passa por cima da mais nova; sem hora, só onde a nuvem também não tem hora', () => {
        const hora = new Date('2026-10-16T15:00:00.000Z')
        expect(ondeGravarANota(VENDA, hora)).toEqual({ id: VENDA, OR: [{ nfce_changed_at: null }, { nfce_changed_at: { lte: hora } }] })
        expect(ondeGravarANota(VENDA, null)).toEqual({ id: VENDA, nfce_changed_at: null })
    })

    it('complementos guardados no formato da web; sem escolhas = nada', () => {
        expect(complementosParaGuardar({ ComplementosEscolhidos: [
            { Grupo: 'Adicionais', Nome: ' Bacon ', Quantidade: 2, Preco: 5.5, ObservacaoRapida: false },
            { Nome: 'SEM GELO', ObservacaoRapida: true },
            { Nome: '   ' },
        ] })).toEqual([
            { grupo: 'Adicionais', nome: 'Bacon', quantidade: 2, preco: 5.5, observacaoRapida: false },
            { grupo: null, nome: 'SEM GELO', quantidade: 1, preco: 0, observacaoRapida: true },
        ])
        expect(complementosParaGuardar({ ComplementosEscolhidos: [] })).toBeNull()
        expect(complementosParaGuardar({})).toBeNull()
    })

    it('item que já está na nuvem: completa só o vazio, nunca troca o gravado', () => {
        const novos = camposDoItem({ NomeVendido: 'X-Salada', VendedorNome: 'Ana', VendedorNumero: 3, ObservacaoLivre: 'sem cebola' }, FUNCIONARIA_ANA)
        const guardado = { sold_name: 'X-Salada (antigo)', seller_employee_id: null, seller_name: null, seller_number: null, complements: null, note: null }
        expect(camposQueFaltam(guardado, novos)).toEqual({ seller_employee_id: FUNCIONARIA_ANA, seller_name: 'Ana', seller_number: 3, note: 'sem cebola' })
        expect(camposQueFaltam({ ...guardado, sold_name: 'a', seller_employee_id: 'b', seller_name: 'c', seller_number: 1, note: 'd' }, novos)).toEqual({})
    })
})

describe('venda do PDV com os dados novos', () => {
    let tx: any
    beforeEach(() => {
        zerar()
        tx = {
            sale: {
                findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})), update: vi.fn(),
                updateMany: vi.fn(async () => ({ count: 1 })),
            },
            cashierSession: { findUnique: vi.fn(async () => ({ status: 'OPEN' })) },
            cashierEntry: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
            saleItem: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
            clientTab: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
            employee: { findFirst: vi.fn(async ({ where }: any) => (where.OR.some((c: any) => c.user_id === USUARIO_ANA) ? { id: FUNCIONARIA_ANA } : null)) },
        }
        db.paymentIdentifier = { findMany: vi.fn(async () => []) }
        db.pOSMachine = { findMany: vi.fn(async () => []) }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    const item = (extra: Record<string, any> = {}) => ({ Uuid: ITEM, Quantity: 1, UnitPrice: 30, ...extra })
    const venda = (extra: Record<string, any> = {}, itens = [item()]) => ({
        Uuid: VENDA, CashierSessionId: CAIXA, Origin: 'Balcao', TotalAmount: 30, Items: itens,
        Payments: [{ Method: 'Dinheiro', Amount: 30 }], ...extra,
    })
    const ITEM_COMPLETO = {
        NomeVendido: '1/2 Calabresa + 1/2 Frango', VendedorId: USUARIO_ANA, VendedorNome: 'Ana', VendedorNumero: 3,
        ComplementosEscolhidos: [{ Grupo: 'Bordas', Nome: 'Catupiry', Quantidade: 1, Preco: 8, ObservacaoRapida: false }],
        ObservacaoLivre: 'bem assada',
    }

    it('venda nova: o item guarda nome, vendedor (funcionária achada pelo usuário), complementos e observação; a venda guarda a nota', async () => {
        const r = resposta()
        await postSalesSync({ body: [venda({ NotaFiscal: NOTA }, [item(ITEM_COMPLETO)])] } as any, r)
        expect(r.code).toBe(201)
        expect(r.body).toMatchObject({ accepted: [VENDA], notaFiscal: true })
        expect(tx.saleItem.create.mock.calls[0][0].data).toMatchObject({
            id: ITEM, sold_name: '1/2 Calabresa + 1/2 Frango', seller_employee_id: FUNCIONARIA_ANA, seller_name: 'Ana', seller_number: 3,
            complements: [{ grupo: 'Bordas', nome: 'Catupiry', quantidade: 1, preco: 8, observacaoRapida: false }], note: 'bem assada',
        })
        const nota = tx.sale.updateMany.mock.calls[0][0]
        expect(nota.where).toEqual({ id: VENDA, OR: [{ nfce_changed_at: null }, { nfce_changed_at: { lte: new Date(NOTA.AlteradaEm) } }] })
        expect(nota.data).toMatchObject({ nfce_status: 'AUTORIZADA', nfce_number: 123, nfce_series: 2, nfce_environment: 'P', nfce_key: NOTA.Chave })
    })

    it('vendedor que não é funcionário do RH: fica o nome e o número, sem o código do funcionário', async () => {
        await postSalesSync({ body: [venda({}, [item({ ...ITEM_COMPLETO, VendedorId: '12121212-1212-4121-8121-121212121212' })])] } as any, resposta())
        const data = tx.saleItem.create.mock.calls[0][0].data
        expect(data).not.toHaveProperty('seller_employee_id')
        expect(data).toMatchObject({ seller_name: 'Ana', seller_number: 3 })
    })

    it('PDV antigo (sem os campos novos): nada muda, nem consulta de funcionário nem nota', async () => {
        const r = resposta()
        await postSalesSync({ body: [venda()] } as any, r)
        expect(r.code).toBe(201)
        const data = tx.saleItem.create.mock.calls[0][0].data
        for (const campo of ['sold_name', 'seller_employee_id', 'seller_name', 'seller_number', 'complements', 'note']) expect(data).not.toHaveProperty(campo)
        expect(tx.sale.updateMany).not.toHaveBeenCalled()
        expect(tx.employee.findFirst).not.toHaveBeenCalled()
    })

    it('reenvio igual de caixa conferido com a nota emitida depois (F9): grava a nota e completa o item, sem mexer no dinheiro', async () => {
        tx.sale.findUnique = vi.fn(async () => ({ cashier_session_id: CAIXA, total_amount: 30, discount: 0, status: 'COMPLETED', origin: 'Balcao' }))
        tx.cashierSession.findUnique = vi.fn(async () => ({ status: 'CHECKED' }))
        tx.cashierEntry.findMany = vi.fn(async () => [{ id: 'e1', identification: `Balcao - Pedido #${VENDA.slice(0, 8)}`, payment_method: 'Dinheiro', amount: 30, platform_code: null, platform_own_delivery: null }])
        tx.saleItem.findMany = vi.fn(async () => [{ id: ITEM, sold_name: null, seller_employee_id: null, seller_name: null, seller_number: null, complements: null, note: null }])
        const r = resposta()
        await postSalesSync({ body: [venda({ NotaFiscal: NOTA }, [item(ITEM_COMPLETO)])] } as any, r)
        expect(r.code).toBe(201)
        expect(tx.sale.upsert).not.toHaveBeenCalled()
        expect(tx.cashierEntry.create).not.toHaveBeenCalled()
        expect(tx.cashierEntry.deleteMany).not.toHaveBeenCalled()
        expect(tx.sale.updateMany).toHaveBeenCalledTimes(1)
        expect(tx.saleItem.update).toHaveBeenCalledWith({ where: { id: ITEM }, data: expect.objectContaining({ sold_name: '1/2 Calabresa + 1/2 Frango', seller_employee_id: FUNCIONARIA_ANA, note: 'bem assada' }) })
    })

    it('reenvio igual com o item já completo: não grava nada no item', async () => {
        tx.sale.findUnique = vi.fn(async () => ({ cashier_session_id: CAIXA, total_amount: 30, discount: 0, status: 'COMPLETED', origin: 'Balcao' }))
        tx.cashierEntry.findMany = vi.fn(async () => [{ id: 'e1', identification: `Balcao - Pedido #${VENDA.slice(0, 8)}`, payment_method: 'Dinheiro', amount: 30, platform_code: null, platform_own_delivery: null }])
        tx.saleItem.findMany = vi.fn(async () => [{ id: ITEM, sold_name: 'x', seller_employee_id: FUNCIONARIA_ANA, seller_name: 'Ana', seller_number: 3, complements: [], note: 'y' }])
        await postSalesSync({ body: [venda({}, [item(ITEM_COMPLETO)])] } as any, resposta())
        expect(tx.saleItem.update).not.toHaveBeenCalled()
        expect(tx.employee.findFirst).not.toHaveBeenCalled()
    })
})

describe('rota da nota que mudou depois (POST /api/pdv/sync/sales/fiscal)', () => {
    const OUTRA = '44444444-4444-4444-8444-444444444443'
    const SUMIDA = '44444444-4444-4444-8444-444444444444'
    beforeEach(() => {
        zerar()
        db.sale = {
            // VENDA grava; OUTRA já tem uma mudança mais nova na nuvem; SUMIDA não existe
            updateMany: vi.fn(async ({ where }: any) => ({ count: where.id === VENDA ? 1 : 0 })),
            findUnique: vi.fn(async ({ where }: any) => (where.id === OUTRA ? { id: OUTRA } : null)),
        }
    })

    it('grava a nota cancelada; a mais velha e a venda que a nuvem não tem também voltam (o PDV dá por entregue)', async () => {
        const cancelada = { ...NOTA, Situacao: 'CANCELADA', AlteradaEm: '2026-10-16T16:00:00.000Z' }
        const r = resposta()
        await postSalesFiscalSync({ body: [
            { Uuid: VENDA, NotaFiscal: cancelada },
            { Uuid: OUTRA, NotaFiscal: NOTA },
            { Uuid: SUMIDA, NotaFiscal: NOTA },
        ], log: { warn: vi.fn() } } as any, r)
        expect(r.code).toBe(200)
        expect(r.body).toMatchObject({ accepted: [VENDA, OUTRA], naoEncontradas: [SUMIDA], notaFiscal: true })
        expect(db.sale.updateMany.mock.calls[0][0].data).toMatchObject({ nfce_status: 'CANCELADA', nfce_changed_at: new Date('2026-10-16T16:00:00.000Z') })
    })

    it('idempotente: o mesmo envio duas vezes dá o mesmo resultado', async () => {
        const corpo = [{ Uuid: VENDA, NotaFiscal: NOTA }]
        const r1 = resposta(); const r2 = resposta()
        await postSalesFiscalSync({ body: corpo, log: { warn: vi.fn() } } as any, r1)
        await postSalesFiscalSync({ body: corpo, log: { warn: vi.fn() } } as any, r2)
        expect(r1.body).toEqual(r2.body)
        expect(db.sale.updateMany.mock.calls[0][0]).toEqual(db.sale.updateMany.mock.calls[1][0])
    })

    it('corpo inválido (sem a situação) é recusado antes de gravar', async () => {
        await expect(postSalesFiscalSync({ body: [{ Uuid: VENDA, NotaFiscal: { Numero: 1 } }], log: { warn: vi.fn() } } as any, resposta()))
            .rejects.toBeInstanceOf(ZodError)
        expect(db.sale.updateMany).not.toHaveBeenCalled()
    })
})
