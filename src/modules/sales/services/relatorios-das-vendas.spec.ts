import { describe, expect, it } from 'vitest'
import { montarContextoDasFormas } from './conta-das-vendas'
import {
    FiltroInvalido,
    chaveDoVendedor,
    intervaloDosDias,
    ondeAOrigem,
    ondeAsVendas,
    ondeOVendedor,
    origemDaVenda,
} from './filtros-das-vendas'
import {
    complementosDoItem,
    detalheDaVenda,
    linhaDaVenda,
    produtosVendidos,
    relatorioDeCancelamentos,
    situacaoDaNota,
    vendedoresDoPeriodo,
    type CancelamentoDaVenda,
    type ItemDoRelatorio,
} from './relatorios-das-vendas'

// Módulo Vendas, etapa 3 (D1, D2, D3, D10 e D12 do Thomás, 16/10/2026): lista, detalhe, produtos, vendedores e cancelamentos.

const CTX = montarContextoDasFormas([], [{ name: 'iFood', platform: { code: 'IFOOD' } }, { name: 'Correntista', is_correntista_debt: true }])
const VENDA = '1f9408ee-0000-4000-8000-000000000001'

describe('período em dias operacionais (o dia vira às 05:00 de Brasília)', () => {
    it('um dia vai das 05:00 dele às 05:00 do seguinte; sem datas = hoje', () => {
        const p = intervaloDosDias('2026-10-16', '2026-10-16')
        expect(p.inicio.toISOString()).toBe('2026-10-16T08:00:00.000Z')
        expect(p.fim.toISOString()).toBe('2026-10-17T08:00:00.000Z')
        // 02:00 de Brasília do dia 17 ainda é o dia 16
        const hoje = intervaloDosDias(null, null, new Date('2026-10-17T05:00:00.000Z'))
        expect(hoje.de).toBe('2026-10-16')
        expect(intervaloDosDias('2026-10-01', null).ate).toBe('2026-10-01')
    })

    it('data errada, fim antes do começo ou mais de um ano: recusa com motivo', () => {
        expect(() => intervaloDosDias('16/10/2026', null)).toThrow(FiltroInvalido)
        expect(() => intervaloDosDias('2026-10-16', '2026-10-01')).toThrow('antes da inicial')
        expect(() => intervaloDosDias('2025-01-01', '2026-10-16')).toThrow('até 1 ano')
    })
})

describe('origem da venda (uma regra só para a lista, o detalhe e o filtro)', () => {
    it.each([
        ['Balcao', null, null, 'BALCAO', 'Balcão'],
        ['Balcao', '15', null, 'COMANDA', 'Comanda 15'],
        ['Comanda 15 · João', '15', null, 'COMANDA', 'Comanda 15 · João'],
        ['Salao', '07', null, 'MESA', 'Mesa 07'],
        ['Mesa', '7', null, 'MESA', 'Mesa 7'],
        ['Mesa 21 Conta B', '21', null, 'MESA', 'Mesa 21 Conta B'],
        ['Mesa 99', '99', null, 'MESA', 'Mesa 99'],
        ['Delivery', null, null, 'DELIVERY', 'Delivery'],
        ['Delivery', null, 'IFOOD', 'IFOOD', 'iFood'],
        ['iFood', null, null, 'IFOOD', 'iFood'],
        ['99Food', null, null, '99FOOD', '99Food'],
        [null, null, null, 'BALCAO', 'Balcão'],
    ])('%s / %s / %s → %s', (origem, id, plataforma, tipo, rotulo) => {
        expect(origemDaVenda(origem, id, plataforma)).toEqual({ tipo, rotulo })
    })

    it('o filtro do banco existe para as 6 origens e nada para uma desconhecida', () => {
        for (const t of ['BALCAO', 'MESA', 'COMANDA', 'DELIVERY', 'IFOOD', '99FOOD']) expect(ondeAOrigem(t)).not.toBeNull()
        expect(ondeAOrigem('XYZ')).toBeNull()
        // iFood pago em dinheiro também é iFood (pelo código da plataforma nos pagamentos)
        expect(JSON.stringify(ondeAOrigem('IFOOD'))).toContain('"platform_code":"IFOOD"')
    })
})

describe('filtros das vendas', () => {
    it('busca por número (pedido, senha, nota), pelo código curto e pelo texto', () => {
        const w: any = ondeAsVendas({ busca: '#1f9408ee' })
        const ou = w.AND[0].OR
        expect(ou).toContainEqual({ id: { startsWith: '1f9408ee' } })
        const n: any = ondeAsVendas({ busca: '42' })
        expect(n.AND[0].OR).toEqual(expect.arrayContaining([{ display_id: 42 }, { daily_number: 42 }, { nfce_number: 42 }]))
    })

    it('situação, caixa, operador e forma', () => {
        const w: any = ondeAsVendas({ caixaId: 'cx', soDoOperador: 'u1', situacao: 'canceladas', forma: ' PIX ' })
        expect(w.AND).toEqual(expect.arrayContaining([
            { cashier_session_id: 'cx' },
            { cashierSession: { user_id: 'u1' } },
            { status: 'CANCELLED' },
            { entries: { some: { payment_method: { equals: 'PIX', mode: 'insensitive' }, is_withdrawal: false } } },
        ]))
        expect(ondeAsVendas({})).toEqual({})
    })

    it('vendedor: funcionário do RH, nome do PDV ou sem vendedor', () => {
        expect(chaveDoVendedor({ seller_employee_id: 'f1', seller_name: 'Ana' })).toBe('f:f1')
        expect(chaveDoVendedor({ seller_name: ' Bia ' })).toBe('n:Bia')
        expect(chaveDoVendedor({})).toBe('sem')
        expect(ondeOVendedor('f:f1')).toEqual({ seller_employee_id: 'f1' })
        expect(ondeOVendedor('n:Bia')).toEqual({ seller_employee_id: null, seller_name: { equals: 'Bia', mode: 'insensitive' } })
        expect(ondeOVendedor('sem')).toEqual({ seller_employee_id: null, OR: [{ seller_name: null }, { seller_name: '' }] })
    })
})

const cancelamento = (extra: Partial<CancelamentoDaVenda>): CancelamentoDaVenda => ({
    id: 'c1', sale_id: VENDA, product_name: 'X-Salada', quantity: 1, total_amount: 30, cancellation_type: 'ITEM_AVULSO',
    reason: 'Lançado errado', user_name: 'Marcos', stock_restored: true, cancelled_at: '2026-10-16T20:00:00.000Z', ...extra,
})

describe('linha da lista', () => {
    const base = {
        id: VENDA, created_at: '2026-10-16T18:30:00.000Z', status: 'COMPLETED', total_amount: 62, origin: 'Salao', origin_identifier: '07',
        display_id: 1234, daily_number: 7, nfce_status: 'AUTORIZADA', nfce_number: 123, nfce_series: 2,
        cashierSession: { id: 'cx', period: 'Turno 01', terminal_id: 'TERM-AB12CD34', opened_at: '2026-10-16T13:00:00.000Z', status: 'OPEN' },
        entries: [
            { amount: 30, payment_method: 'PIX', bank: 'STONE' },
            { amount: 20, payment_method: 'PIX', bank: null },
            { amount: 12, payment_method: 'Dinheiro' },
        ],
        _count: { items: 3 },
    }

    it('número, senha, origem, caixa e computador, formas somadas e a nota em palavras', () => {
        const l = linhaDaVenda(base, [], CTX)
        expect(l).toMatchObject({
            codigo: '#1f9408ee', numero: 1234, senha: 7, origem: { tipo: 'MESA', rotulo: 'Mesa 07' },
            caixa: { id: 'cx', nome: 'Turno 01', computador: 'TERM-AB12CD34' }, total: 62, itens: 3, cancelada: false, cancelamento: null,
            nota: { situacao: 'AUTORIZADA', rotulo: 'Autorizada', numero: 123, serie: 2 },
        })
        expect(l.formas).toEqual([{ forma: 'PIX', valor: 50 }, { forma: 'Dinheiro', valor: 12 }])
    })

    it('venda antiga sem os dados novos: número, senha e nota vazios ("—" na web)', () => {
        const l = linhaDaVenda({ id: VENDA, created_at: base.created_at, status: 'COMPLETED', total_amount: 10 })
        expect(l).toMatchObject({ numero: null, senha: null, nota: null, caixa: null, origem: { tipo: 'BALCAO' } })
    })

    it('cancelada: continua na lista, sem formas, com motivo, quem e quando (D12)', () => {
        const l = linhaDaVenda({ ...base, status: 'CANCELLED', entries: [] }, [
            cancelamento({ cancellation_type: 'VENDA_COMPLETA', reason: 'Cliente desistiu', user_name: 'Ana', cancelled_at: '2026-10-16T19:00:00.000Z' }),
        ])
        expect(l.cancelada).toBe(true)
        expect(l.formas).toEqual([])
        expect(l.cancelamento).toEqual({ motivo: 'Cliente desistiu', quem: 'Ana', quando: '2026-10-16T19:00:00.000Z' })
    })

    it('situação da nota em palavras; sem situação = null', () => {
        expect(situacaoDaNota('cancelamento_falhou')).toBe('Cancelamento falhou')
        expect(situacaoDaNota(null)).toBeNull()
    })
})

describe('detalhe da venda (D3)', () => {
    const venda = {
        id: VENDA, created_at: '2026-10-16T18:30:00.000Z', status: 'COMPLETED', total_amount: 69, discount: 5, delivery_fee: 0,
        service_fee: 6, cover_charge: 0, origin: 'Balcao', origin_identifier: null, nfce_status: 'AUTORIZADA', nfce_number: 9,
        nfce_series: 3, nfce_environment: 'P', nfce_key: '3526', nfce_contingency: false,
        items: [{
            id: 'i1', product_id: 'p1', sold_name: 'Pizza G 1/2 Calabresa + 1/2 Frango', quantity: 1, unit_price: 68, discount: 0,
            unit_cost: 20, complements_cost: 4, complements: [{ grupo: 'Bordas', nome: 'Catupiry', quantidade: 1, preco: 8, observacaoRapida: false }],
            note: 'bem assada', seller_employee_id: 'f1', seller_name: 'Ana', seller_number: 3, seller: { name: 'Ana Souza' },
            product: { id: 'p1', name: 'Pizza Grande', display_id: 501, measureUnit: 'UNITARY' },
        }],
        entries: [
            { id: 'e1', amount: 40, payment_method: 'Correntista', client_id: 'c1', client: { id: 'c1', name: 'João' } },
            { id: 'e2', amount: 29, payment_method: 'PIX', bank: null, identification: '[Caixinha: R$ 0,00]' },
        ],
    }
    const extras = {
        operador: 'Marcos',
        baixas: [{ id: 's1', sale_item_id: 'i1', supply_id: 'farinha', quantity: 0.3, operation: 'OUT', description: 'VENDA', unit_cost: 5, created_at: '2026-10-16T18:30:00.000Z', supply: { id: 'farinha', name: 'Farinha' } }],
        cancelamentos: [cancelamento({ id: 'c9', item_id: 'outro-item', product_name: 'Refrigerante', quantity: 2, total_amount: 12, reason: 'Sem gelo', stock_restored: false })],
    }

    it('itens com o nome como vendido, vendedor, complementos, observação, custo e margem', () => {
        const d = detalheDaVenda(venda, extras, true, CTX)
        expect(d.itens[0]).toMatchObject({
            nome: 'Pizza G 1/2 Calabresa + 1/2 Frango', nomeNoCadastro: 'Pizza Grande', codigo: 501, quantidade: 1, total: 68,
            vendedor: { nome: 'Ana Souza', numero: 3, chave: 'f:f1' }, observacao: 'bem assada', custo: 24, margem: 44, margemPercentual: 64.71,
            complementos: [{ grupo: 'Bordas', nome: 'Catupiry', quantidade: 1, preco: 8, observacaoRapida: false }],
        })
        expect(d.valores).toMatchObject({ itens: 68, desconto: 5, servico: 6, total: 69, custo: 24, margem: 44 })
        expect(d.operador).toBe('Marcos')
    })

    it('item cancelado entra riscado (cancelado: true) e fora do valor dos itens', () => {
        const d = detalheDaVenda(venda, extras, true, CTX)
        const riscado = d.itens.find(i => i.cancelado)!
        expect(riscado).toMatchObject({ nome: 'Refrigerante', quantidade: 2, total: 12, precoUnitario: 6, observacao: 'Sem gelo' })
        expect(d.valores.itens).toBe(68)
        expect(d.cancelamentos[0]).toMatchObject({ produto: 'Refrigerante', voltouAoEstoque: false, quem: 'Marcos' })
    })

    it('pagamentos com o tipo e a pessoa do a prazo; Pix sem maquininha; nota; estoque; sem permissão, sem custo', () => {
        const d = detalheDaVenda(venda, extras, false, CTX)
        expect(d.pagamentos).toEqual([
            expect.objectContaining({ forma: 'Correntista', tipo: 'PRAZO', pessoa: 'João', valor: 40 }),
            expect.objectContaining({ forma: 'PIX', tipo: 'CONTADA', maquininha: 'Sem maquininha', semMaquininha: true, valor: 29 }),
        ])
        expect(d.nota).toMatchObject({ rotulo: 'Autorizada', numero: 9, serie: 3, ambiente: 'Produção', chave: '3526' })
        expect(d.estoque[0]).toMatchObject({ nome: 'Farinha', ehInsumo: true, quantidade: 0.3, entrada: false, custoUnitario: null })
        expect(d.itens[0]).toMatchObject({ custo: null, margem: null })
        expect(d.valores.custo).toBeNull()
        expect(d.troco).toBeNull()
    })

    it('complementos: só a lista guardada pelo PDV novo; o resto = null', () => {
        expect(complementosDoItem(null)).toBeNull()
        expect(complementosDoItem({ adicionais: [] })).toBeNull()
        expect(complementosDoItem([{ nome: '' }])).toBeNull()
    })
})

const item = (extra: Partial<ItemDoRelatorio>): ItemDoRelatorio => ({ sale_id: 'v1', product_id: 'p1', quantity: 1, unit_price: 10, discount: 0, unit_cost: 4, complements_cost: 0, product: { id: 'p1', name: 'Pão de queijo', display_id: 10 }, ...extra })

describe('produtos vendidos', () => {
    const itens = [
        item({}),
        item({ sale_id: 'v2', quantity: 2 }),
        item({ sale_id: 'v3', product_id: 'p2', unit_price: 50, unit_cost: null, complements_cost: null, product: { id: 'p2', name: 'Bolo', display_id: 20 } }),
        item({ sale_id: 'v3', product_id: 'p2', unit_price: 50, unit_cost: 20, product: { id: 'p2', name: 'Bolo', display_id: 20 } }),
        item({ sale_id: 'v4', product_id: null, sold_name: 'Item Não Mapeado', product: null, unit_price: 5, unit_cost: null, complements_cost: null }),
    ]

    it('quantidade, faturamento, custo, margem (só dos itens com custo) e participação', () => {
        const r = produtosVendidos(itens, true)
        expect(r.produtos.map(p => [p.nome, p.quantidade, p.faturamento, p.custo, p.margem, p.semCusto, p.participacao])).toEqual([
            ['Bolo', 2, 100, 20, 30, 1, 74.07],
            ['Pão de queijo', 3, 30, 12, 18, 0, 22.22],
            ['Item Não Mapeado', 1, 5, null, null, 1, 3.7],
        ])
        expect(r.produtos[0].vendas).toBe(1)
        expect(r.totais).toMatchObject({ produtos: 3, faturamento: 135, custo: 32, margem: 48, itensSemCusto: 2 })
    })

    it('sem permissão de custo: custo e margem vazios', () => {
        const r = produtosVendidos(itens, false)
        expect(r.produtos.every(p => p.custo === null && p.margem === null && p.semCusto === null)).toBe(true)
        expect(r.totais.custo).toBeNull()
    })
})

describe('vendedores', () => {
    it('por item: itens, vendas, faturamento e os produtos de cada um; "Sem vendedor" no fim', () => {
        const r = vendedoresDoPeriodo([
            item({ seller_employee_id: 'f1', seller_name: 'Ana', seller_number: 3, seller: { name: 'Ana Souza' } }),
            item({ sale_id: 'v2', seller_employee_id: 'f1', seller_name: 'Ana', quantity: 2 }),
            item({ sale_id: 'v2', product_id: 'p2', unit_price: 50, seller_name: 'Bia', product: { name: 'Bolo' } }),
            item({ sale_id: 'v9' }),
        ])
        expect(r.vendedores.map(v => [v.nome, v.itens, v.vendas, v.faturamento])).toEqual([
            ['Bia', 1, 1, 50], ['Ana Souza', 3, 2, 30], ['Sem vendedor', 1, 1, 10],
        ])
        expect(r.vendedores[1]).toMatchObject({ numero: 3, chave: 'f:f1', produtos: [{ nome: 'Pão de queijo', quantidade: 3, faturamento: 30 }] })
        expect(r.totais).toEqual({ faturamento: 90, vendedores: 2 })
    })
})

describe('cancelamentos', () => {
    it('totais (vendas inteiras × itens, o que voltou ao estoque) e as listas de motivos e pessoas', () => {
        const r = relatorioDeCancelamentos([
            cancelamento({ id: 'a', cancellation_type: 'VENDA_COMPLETA', total_amount: 62, reason: 'Cliente desistiu', user_name: 'Ana' }),
            cancelamento({ id: 'b', total_amount: '12.5', stock_restored: false, cancelled_at: '2026-10-16T21:00:00.000Z' }),
            cancelamento({ id: 'c', sale_id: null, total_amount: 8 }),
        ], new Map([[VENDA, { display_id: 1234, daily_number: 7 }]]))
        expect(r.cancelamentos.map(c => c.id)).toEqual(['b', 'a', 'c'])
        expect(r.cancelamentos[0].venda).toEqual({ id: VENDA, codigo: '#1f9408ee', numero: 1234, senha: 7 })
        expect(r.cancelamentos[2].venda).toBeNull()
        expect(r.totais).toEqual({ quantidade: 3, valor: 82.5, vendasInteiras: 1, itens: 2, voltaramAoEstoque: 2, valorQueVoltou: 70 })
        expect(r.motivos).toEqual(['Cliente desistiu', 'Lançado errado'])
        expect(r.pessoas).toEqual(['Ana', 'Marcos'])
    })
})
