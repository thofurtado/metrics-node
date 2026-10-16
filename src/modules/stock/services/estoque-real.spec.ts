import { describe, expect, it, vi } from 'vitest'

// Etapa 4 do Vendas e Estoque (16/10/2026): regras puras do estoque de verdade (D5, D6, D8 e D12 do Thomás).
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { planejarBaixa, temFichaTecnica, type ProdutoDaBaixa } from './baixa-da-venda'
import {
    destinoDoEstoque,
    detalheDoMovimento,
    filtroDoTipo,
    intervaloDoPeriodo,
    notaDoEstorno,
    numeroDaVenda,
    origemDaVenda,
    quemFez,
    saldosDoHistorico,
    tipoDoFiltro,
    tipoDoMovimento,
    unidadeDoItem,
    type VendaDaLinha,
} from './historico-do-estoque'
import { linhaDoMovimento, mudancaDoSaldo, registrarMovimento } from './movimento-de-estoque'
import { situacaoDoSaldo } from './posicao-do-estoque'

const PAO = 'sup-pao'
const CARNE = 'sup-carne'
const BACON = 'sup-bacon'

const xBurguer: ProdutoDaBaixa = {
    id: 'prod-x', cost: 12, is_composite: true,
    compositions: [
        { supply_id: PAO, quantity: 1, supply: { cost: 1.5 } },
        { supply_id: CARNE, quantity: 0.18, supply: { cost: 40 } },
    ],
}
const coca: ProdutoDaBaixa = { id: 'prod-coca', cost: 3.2, is_composite: false, compositions: [] }

describe('o que cada item vendido baixa (D8)', () => {
    it('produto com ficha técnica baixa os insumos da ficha × a quantidade vendida', () => {
        const linhas = planejarBaixa({ quantidade: 2, produto: xBurguer, fracoes: [], complementos: [] })
        expect(linhas).toEqual([
            { alvo: { tipo: 'SUPPLY', id: PAO }, quantidade: 2, custoUnitario: 1.5, origem: 'FICHA' },
            { alvo: { tipo: 'SUPPLY', id: CARNE }, quantidade: 0.36, custoUnitario: 40, origem: 'FICHA' },
        ])
    })

    it('produto sem ficha baixa ele mesmo (com o custo congelado na venda, se houver)', () => {
        expect(planejarBaixa({ quantidade: 3, produto: coca, custoUnitarioDoItem: 3.5, fracoes: [], complementos: [] })).toEqual([
            { alvo: { tipo: 'PRODUCT', id: 'prod-coca' }, quantidade: 3, custoUnitario: 3.5, origem: 'PRODUTO' },
        ])
    })

    it('"composto" sem nenhuma linha na ficha conta como sem ficha: baixa ele mesmo', () => {
        const vazio = { ...xBurguer, compositions: [] }
        expect(temFichaTecnica(vazio)).toBe(false)
        expect(planejarBaixa({ quantidade: 1, produto: vazio, fracoes: [], complementos: [] })[0]).toMatchObject({ alvo: { tipo: 'PRODUCT', id: 'prod-x' } })
        // e ficha com linhas mas sem a marca de composto (cadastro antigo) também baixa o produto, como o custo (item-cost.ts)
        expect(temFichaTecnica({ ...xBurguer, is_composite: false })).toBe(false)
    })

    it('pizza de dois sabores: cada sabor na sua fração, com a mesma regra', () => {
        const linhas = planejarBaixa({
            quantidade: 2, produto: null, complementos: [],
            fracoes: [{ fracao: 0.5, produto: xBurguer }, { fracao: 0.5, produto: coca }],
        })
        expect(linhas.map(l => [l.alvo.id, l.quantidade])).toEqual([[PAO, 1], [CARNE, 0.18], ['prod-coca', 1]])
    })

    it('complemento com insumo ligado baixa o insumo na quantidade da opção × a escolhida × a vendida', () => {
        const linhas = planejarBaixa({
            quantidade: 2, produto: coca, fracoes: [],
            complementos: [{ quantidade: 3, opcao: { id: 'op-bacon', linked_supply_id: BACON, supply_quantity: 0.02, supply: { id: BACON, cost: 60 } } }],
        })
        expect(linhas[1]).toEqual({ alvo: { tipo: 'SUPPLY', id: BACON }, quantidade: 0.12, custoUnitario: 60, origem: 'COMPLEMENTO' })
    })

    it('opção da nuvem sem insumo não baixa nada (nem o insumo que o PDV conhecia); opção apagada usa o do PDV, 1 por unidade', () => {
        const semInsumo = planejarBaixa({
            quantidade: 1, produto: null, fracoes: [],
            complementos: [{ quantidade: 1, opcao: { id: 'op', linked_supply_id: null, supply_quantity: 1 }, insumoDoPdv: { id: BACON, cost: 1 } }],
        })
        expect(semInsumo).toEqual([])
        const apagada = planejarBaixa({ quantidade: 2, produto: null, fracoes: [], complementos: [{ quantidade: 1, opcao: null, insumoDoPdv: { id: BACON, cost: 1 } }] })
        expect(apagada).toEqual([{ alvo: { tipo: 'SUPPLY', id: BACON }, quantidade: 2, custoUnitario: 1, origem: 'COMPLEMENTO' }])
    })

    it('item sem produto na nuvem (iFood sem vínculo) ou com quantidade zero não baixa nada', () => {
        expect(planejarBaixa({ quantidade: 1, produto: null, fracoes: [], complementos: [] })).toEqual([])
        expect(planejarBaixa({ quantidade: 0, produto: coca, fracoes: [], complementos: [] })).toEqual([])
    })
})

describe('o movimento muda o saldo e guarda quem fez e o saldo depois (D6)', () => {
    it('baixa e entrada somam ou tiram; o ajuste grava o saldo exato', () => {
        expect(mudancaDoSaldo({ operacao: 'OUT', quantidade: 2 })).toEqual({ stock: { decrement: 2 } })
        expect(mudancaDoSaldo({ operacao: 'IN', quantidade: 2 })).toEqual({ stock: { increment: 2 } })
        expect(mudancaDoSaldo({ operacao: 'IN', quantidade: 2, saldoNovo: 10 })).toEqual({ stock: 10 })
    })

    it('grava a linha com o saldo devolvido pelo cadastro, na mesma transação; custo novo só se maior que zero', async () => {
        const tx: any = {
            product: { update: vi.fn(async () => ({ stock: -1 })) },
            supply: { update: vi.fn(async () => ({ stock: 4.5 })) },
            stock: { create: vi.fn(async ({ data }: any) => ({ id: 'mov-1', ...data })) },
        }
        const r = await registrarMovimento(tx, {
            alvo: { tipo: 'PRODUCT', id: 'prod-coca' }, operacao: 'OUT', quantidade: 2, motivo: 'VENDA', saleItemId: 'item-1', custoNovo: 0,
        })
        expect(r).toEqual({ id: 'mov-1', saldoDepois: -1 }) // saldo negativo é aceito: nada trava (D5)
        expect(tx.product.update.mock.calls[0][0]).toEqual({ where: { id: 'prod-coca' }, data: { stock: { decrement: 2 } }, select: { stock: true } })
        expect(tx.stock.create.mock.calls[0][0].data).toMatchObject({ product_id: 'prod-coca', supply_id: null, sale_item_id: 'item-1', balance_after: -1, description: 'VENDA' })

        await registrarMovimento(tx, {
            alvo: { tipo: 'SUPPLY', id: PAO }, operacao: 'IN', quantidade: 3, motivo: 'COMPRA', custoNovo: 1.6,
            usuario: { id: 'u1', nome: 'Thomás' }, documento: { chave: '35261012345678000199550010000012341000012345', numero: '1234' },
        })
        expect(tx.supply.update.mock.calls[0][0].data).toEqual({ stock: { increment: 3 }, cost: 1.6 })
        expect(tx.stock.create.mock.calls[1][0].data).toMatchObject({ supply_id: PAO, user_id: 'u1', user_name: 'Thomás', balance_after: 4.5, document_number: '1234' })
    })

    it('texto vazio vira nulo e o texto longo é cortado', () => {
        const linha = linhaDoMovimento({ alvo: { tipo: 'SUPPLY', id: PAO }, operacao: 'IN', quantidade: 1, motivo: 'AJUSTE_POSITIVO', nota: '   ', usuario: { nome: 'x'.repeat(200) } }, 1)
        expect(linha.note).toBeNull()
        expect((linha.user_name as string).length).toBe(120)
    })
})

describe('saldo antes e depois no histórico (D6)', () => {
    const l = (id: string, operation: 'IN' | 'OUT', quantity: number, balance_after: number | null = null, product_id: string | null = 'A', supply_id: string | null = null) =>
        ({ id, operation, quantity, balance_after, product_id, supply_id })

    it('sem saldo gravado: calcula para trás a partir do saldo atual do cadastro', () => {
        const saldos = saldosDoHistorico([l('3', 'OUT', 1), l('2', 'OUT', 2), l('1', 'IN', 10)], new Map([['P:A', 7]]))
        expect(saldos.get('3')).toEqual({ antes: 8, depois: 7, calculado: true })
        expect(saldos.get('2')).toEqual({ antes: 10, depois: 8, calculado: true })
        expect(saldos.get('1')).toEqual({ antes: 0, depois: 10, calculado: true })
    })

    it('o saldo gravado na linha manda e vira o ponto de partida dos mais velhos', () => {
        // o cadastro foi mudado sem movimento depois da linha 2 (saldo atual 50): a linha 2 mostra o que era na hora
        const saldos = saldosDoHistorico([l('3', 'OUT', 1), l('2', 'OUT', 2, 5), l('1', 'IN', 7)], new Map([['P:A', 50]]))
        expect(saldos.get('3')).toEqual({ antes: 51, depois: 50, calculado: true })
        expect(saldos.get('2')).toEqual({ antes: 7, depois: 5, calculado: false })
        expect(saldos.get('1')).toEqual({ antes: 0, depois: 7, calculado: true })
    })

    it('produto e insumo na mesma página andam cada um no seu saldo; arredonda o quebrado do quilo', () => {
        const saldos = saldosDoHistorico(
            [l('b', 'OUT', 0.1, null, null, 'S1'), l('a', 'OUT', 1, null, 'A'), l('c', 'OUT', 0.2, null, null, 'S1')],
            new Map([['P:A', 3], ['S:S1', 0.3]]),
        )
        expect(saldos.get('a')).toEqual({ antes: 4, depois: 3, calculado: true })
        expect(saldos.get('b')).toEqual({ antes: 0.4, depois: 0.3, calculado: true })
        expect(saldos.get('c')).toEqual({ antes: 0.6, depois: 0.4, calculado: true })
    })
})

describe('tipo, quem fez e de onde veio cada movimento (D6, D12)', () => {
    const venda = (extra: Partial<VendaDaLinha> = {}): VendaDaLinha => ({
        id: '1f9408ee-0000-4000-8000-000000000001', status: 'COMPLETED', origin: 'Balcao', origin_identifier: '54',
        operador: 'Maria', vendedor: 'Ana', estornado: false, ...extra,
    })
    const base = { operation: 'OUT' as const, description: 'VENDA', sale_item_id: 'item-1', document_key: null, document_number: null }

    it('venda, perda da venda cancelada que não voltou, estorno, compra pela NF-e, perdas e ajuste', () => {
        expect(tipoDoMovimento(base, venda())).toEqual({ tipo: 'VENDA', rotulo: 'Venda' })
        expect(tipoDoMovimento(base, venda({ status: 'CANCELLED' }))).toEqual({ tipo: 'PERDA', rotulo: 'Perda · venda cancelada' })
        expect(tipoDoMovimento(base, venda({ status: 'CANCELLED', estornado: true }))).toEqual({ tipo: 'VENDA', rotulo: 'Venda' })
        expect(tipoDoMovimento({ ...base, operation: 'IN', description: 'DEVOLUCAO' }, null).rotulo).toBe('Estorno da venda')
        expect(tipoDoMovimento({ ...base, operation: 'IN', description: 'COMPRA', sale_item_id: null, document_number: '12' }, null).rotulo).toBe('Compra · NF-e')
        expect(tipoDoMovimento({ ...base, description: 'QUEBRA', sale_item_id: null }, null)).toEqual({ tipo: 'PERDA', rotulo: 'Perda · quebra' })
        expect(tipoDoMovimento({ ...base, description: 'AJUSTE_NEGATIVO', sale_item_id: null }, null).tipo).toBe('AJUSTE')
    })

    it('o filtro da tela antiga (SALE_PDV) é a venda: antes o extrato mostrava "0 registros" com 786 baixas no banco', () => {
        expect(tipoDoFiltro('SALE_PDV')).toBe('VENDA')
        expect(tipoDoFiltro('todos')).toBeNull()
        expect(filtroDoTipo('VENDA')).toMatchObject({ description: 'VENDA' })
        expect(filtroDoTipo('PERDA')).toEqual({
            OR: [
                { description: { in: ['QUEBRA', 'PERDA', 'CORTESIA', 'CONSUMO_INTERNO'] } },
                { description: 'VENDA', saleItem: { sale: { status: 'CANCELLED' }, stocks: { none: { operation: 'IN' } } } },
            ],
        })
        expect(filtroDoTipo(tipoDoFiltro('ESTORNO'))).toEqual({ description: 'DEVOLUCAO' })
    })

    it('quem fez: o usuário gravado; da venda, o operador do caixa e o vendedor; da perda, quem cancelou', () => {
        expect(quemFez({ user_name: 'Thomás', description: 'COMPRA', operation: 'IN' })).toBe('Thomás')
        expect(quemFez({ user_name: null, description: 'VENDA', operation: 'OUT' }, venda())).toBe('Maria (caixa) · Ana (vendedor)')
        expect(quemFez({ user_name: null, description: 'VENDA', operation: 'OUT' }, venda({ vendedor: null }))).toBe('Maria (caixa)')
        expect(quemFez({ user_name: null, description: 'VENDA', operation: 'OUT' }, venda({ status: 'CANCELLED' }),
            { reason: 'Erro', user_name: 'João', stock_destination: 'DESPERDICIO', cancelled_at: null, origin_identifier: 'Venda #123' })).toBe('João (cancelou)')
        expect(quemFez({ user_name: null, description: 'AJUSTE_POSITIVO', operation: 'IN' })).toBeNull()
    })

    it('o estorno diz o número da venda do PDV ("Venda #123"); sem ele, o código curto da venda', () => {
        expect(notaDoEstorno('Venda #123', 'abc')).toBe('Estorno da venda #123')
        expect(notaDoEstorno(null, '1f9408ee-0000-4000-8000-000000000001')).toBe('Estorno da venda #1f9408ee')
        expect(numeroDaVenda(null)).toBe('#?')
        expect(destinoDoEstoque(' estorno ')).toBe('ESTORNO')
        expect(destinoDoEstoque('DESPERDICIO')).toBe('DESPERDICIO')
        expect(destinoDoEstoque('QUALQUER')).toBeNull()
    })

    it('o toque abre a venda ou a nota de compra; ajuste não tem origem', () => {
        const linha = { id: 'm', created_at: new Date(), quantity: 1, unit_cost: 1, product_id: 'A', supply_id: null, user_name: null, balance_after: null, note: null, ...base }
        expect(detalheDoMovimento(linha, venda())).toEqual({
            detalhe: 'Venda #1f9408ee · Balcão · 54',
            origem: { tipo: 'VENDA', id: venda().id, rotulo: 'Ver venda #1f9408ee' },
        })
        const perda = detalheDoMovimento(linha, venda({ status: 'CANCELLED' }), { reason: 'Caiu no chão', user_name: 'João', stock_destination: 'DESPERDICIO', cancelled_at: null, origin_identifier: 'Venda #77' })
        expect(perda.detalhe).toBe('Venda #77 cancelada · desperdício · Caiu no chão')
        const compra = detalheDoMovimento({ ...linha, description: 'COMPRA', operation: 'IN', sale_item_id: null, document_key: 'CHAVE', document_number: '1234' }, null, null, 'Distribuidora X')
        expect(compra).toEqual({ detalhe: 'NF-e 1234 · Distribuidora X', origem: { tipo: 'NFE', id: 'CHAVE', rotulo: 'Ver NF-e 1234' } })
        expect(detalheDoMovimento({ ...linha, description: 'AJUSTE_POSITIVO', sale_item_id: null, note: 'Inventário de 16/10/2026' }, null).origem).toBeNull()
    })

    it('nome da origem da venda e unidade do item', () => {
        expect(origemDaVenda('Balcao', '')).toBe('Balcão')
        expect(origemDaVenda('Delivery', null)).toBe('Delivery')
        expect(unidadeDoItem({ measureUnit: 'FRACTIONAL' }, null)).toBe('kg')
        expect(unidadeDoItem(null, { unit: 'kg' })).toBe('kg')
        expect(unidadeDoItem(null, { unit: null })).toBe('un')
    })
})

describe('período do histórico em dias operacionais (viram às 05:00)', () => {
    const agora = new Date('2026-10-16T15:00:00.000Z') // 12:00 de Brasília
    it('hoje, últimos 7 e 30 dias contam a partir de hoje (antes "30 dias" começava no dia 1º)', () => {
        expect(intervaloDoPeriodo('today', null, null, agora)).toEqual({ inicio: new Date('2026-10-16T08:00:00.000Z'), fim: new Date('2026-10-17T08:00:00.000Z') })
        expect(intervaloDoPeriodo('7days', null, null, agora).inicio).toEqual(new Date('2026-10-10T08:00:00.000Z'))
        expect(intervaloDoPeriodo('30days', null, null, agora).inicio).toEqual(new Date('2026-09-17T08:00:00.000Z'))
        expect(intervaloDoPeriodo('month', null, null, agora).inicio).toEqual(new Date('2026-10-01T08:00:00.000Z'))
        expect(intervaloDoPeriodo('all', null, null, agora)).toEqual({})
    })
    it('de/até escolhidos: o dia "até" entra inteiro', () => {
        expect(intervaloDoPeriodo('custom', '2026-10-01', '2026-10-02', agora)).toEqual({
            inicio: new Date('2026-10-01T08:00:00.000Z'), fim: new Date('2026-10-03T08:00:00.000Z'),
        })
        expect(intervaloDoPeriodo('custom', 'não é data', null, agora)).toEqual({})
    })
})

describe('situação na Posição de Estoque', () => {
    it('zerado ou negativo é crítico; abaixo do mínimo DO CADASTRO é atenção; sem mínimo nada é inventado', () => {
        expect(situacaoDoSaldo(0, null)).toBe('CRITICAL')
        expect(situacaoDoSaldo(-3, 10)).toBe('CRITICAL')
        expect(situacaoDoSaldo(5, 10)).toBe('WARNING')
        expect(situacaoDoSaldo(5, null)).toBe('NORMAL') // antes: "acabando" com menos de 24 unidades sem mínimo cadastrado
        expect(situacaoDoSaldo(11, 10)).toBe('NORMAL')
    })
})
