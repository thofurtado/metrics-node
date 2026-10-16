import { describe, expect, it } from 'vitest'
import {
    CONTEXTO_VAZIO,
    SEM_MAQUININHA,
    caixinhaDoLancamento,
    contaDasVendas,
    custoDoItem,
    lerMoeda,
    maquininhaDoLancamento,
    margem,
    moeda,
    montarContextoDasFormas,
    nomeDaForma,
    tipoDaForma,
    valorDoItem,
    type LancamentoParaConta,
    type VendaParaConta,
} from './conta-das-vendas'

// A conta única (Vendas, etapa 2; D11 do Thomás, 16/10/2026): "Total vendido" × "Total recebido" e a linha da diferença,
// com a mesma separação do fechamento do PDV (formas contadas × sem contagem física; ConferenciaDoFechamento.cs).

// Os cadastros da web da Katatau: a forma "Pago na plataforma" com os identificadores iFood e 99Food, e os a prazo
const CTX = montarContextoDasFormas(
    [{ name: 'Dinheiro', kind: null }, { name: 'Pago na plataforma', kind: 'PLATAFORMA' }],
    [
        { name: 'Correntista', is_correntista_debt: true, platform: null },
        { name: 'Funcionário', is_correntista_debt: true, platform: null },
        { name: 'iFood', platform: { code: 'IFOOD' } },
        { name: '99Food', platform: { code: '99FOOD' } },
    ],
)

const venda = (id: string, total: number, extra: Partial<VendaParaConta> = {}): VendaParaConta => ({ id, status: 'COMPLETED', total_amount: total, ...extra })
const pagamento = (sale_id: string | null, payment_method: string, amount: number, extra: Partial<LancamentoParaConta> = {}): LancamentoParaConta =>
    ({ sale_id, payment_method, amount, bank: null, ...extra })

describe('o tipo de cada forma (igual ao fechamento do PDV)', () => {
    it('dinheiro, Pix, cartões e vale se contam; a prazo e aplicativo ficam sem contagem física', () => {
        expect(tipoDaForma(pagamento('v', 'Dinheiro', 10), CTX)).toBe('DINHEIRO')
        expect(tipoDaForma(pagamento('v', 'PIX', 10), CTX)).toBe('CONTADA')
        expect(tipoDaForma(pagamento('v', 'Cartão de Crédito', 10), CTX)).toBe('CONTADA')
        expect(tipoDaForma(pagamento('v', 'Correntista', 10), CTX)).toBe('PRAZO')
        expect(tipoDaForma(pagamento('v', 'A Prazo (Correntista)', 10))).toBe('PRAZO')
        expect(tipoDaForma(pagamento('v', 'Permuta', 10))).toBe('PRAZO')
        expect(tipoDaForma(pagamento('v', 'Cortesia', 10))).toBe('PRAZO')
        expect(tipoDaForma(pagamento('v', 'Funcionário', 10))).toBe('PRAZO')
        expect(tipoDaForma(pagamento('v', 'iFood', 10), CTX)).toBe('PLATAFORMA')
        expect(tipoDaForma(pagamento('v', 'Pago na plataforma', 10), CTX)).toBe('PLATAFORMA')
        expect(tipoDaForma(pagamento('v', 'iFood (pago no app)', 10))).toBe('PLATAFORMA')
        expect(tipoDaForma(pagamento('v', '99Food (pago no app)', 10))).toBe('PLATAFORMA')
        expect(tipoDaForma(pagamento('v', 'Online', 10))).toBe('PLATAFORMA')
    })

    it('pedido do iFood pago em DINHEIRO na entrega é dinheiro (o motoboy trouxe), como no PDV', () => {
        expect(tipoDaForma(pagamento('v', 'Dinheiro', 50, { platform_code: 'IFOOD' }), CTX)).toBe('DINHEIRO')
    })

    it('lançamento com cliente (fiado) ou funcionário (consumo) é a prazo, qualquer que seja o nome', () => {
        expect(tipoDaForma(pagamento('v', 'Outros', 10, { client_id: 'c1' }))).toBe('PRAZO')
        expect(tipoDaForma(pagamento('v', 'Outros', 10, { employee_id: 'f1' }))).toBe('PRAZO')
    })

    it('nome da forma pela categoria (o nome do PDV antigo cai no da web) e a maquininha', () => {
        expect(nomeDaForma(pagamento('v', 'Cartão de Débito', 1))).toBe('Débito')
        expect(nomeDaForma(pagamento('v', 'Vale Refeição (VR/Sodexo/Alelo)', 1))).toBe('Voucher')
        expect(nomeDaForma(pagamento('v', 'pix', 1))).toBe('PIX')
        expect(nomeDaForma(pagamento('v', 'Correntista', 1), 'PRAZO')).toBe('Correntista')
        expect(maquininhaDoLancamento(pagamento('v', 'PIX', 1, { bank: 'STONE' }))).toBe('STONE')
        expect(maquininhaDoLancamento(pagamento('v', 'PIX', 1, { bank: '' }))).toBe(SEM_MAQUININHA)
        expect(maquininhaDoLancamento(pagamento('v', 'PIX', 1, { bank: 'CAIXA' }))).toBe(SEM_MAQUININHA)
    })
})

describe('caixinha: só o excedente (decisão de 29/09/2026)', () => {
    it('a marca no lançamento é o excedente; a caixinha avulsa é o lançamento inteiro; venda comum = 0', () => {
        expect(caixinhaDoLancamento(pagamento(null, 'Débito', 200, { identification: 'Mesa 5 [Caixinha: R$ 18,00 | João]' }))).toBe(18)
        expect(caixinhaDoLancamento(pagamento(null, 'Dinheiro', 1250, { identification: '[Gorjeta: R$ 1.250,00]' }))).toBe(1250)
        expect(caixinhaDoLancamento(pagamento(null, 'Dinheiro', 10, { type: 'TIP' }))).toBe(10)
        expect(caixinhaDoLancamento(pagamento(null, 'Caixinha', 7, {}))).toBe(7)
        expect(caixinhaDoLancamento(pagamento('v', 'PIX', 100, { identification: 'Balcao - Pedido #1f9408ee' }))).toBe(0)
    })

    it('lê "1.250,00", "1250.00" e "18,00"', () => {
        expect(lerMoeda('1.250,00')).toBe(1250)
        expect(lerMoeda('1250.00')).toBe(1250)
        expect(lerMoeda('18,00')).toBe(18)
        expect(lerMoeda('1,250.50')).toBe(1250.5)
    })
})

describe('a conta de um caixa', () => {
    // Caixa 10 da Katatau (16/10/2026, os números do teste do fechamento do PDV): Pix R$ 2.029,22 (com R$ 29,50 sem
    // maquininha), sem contagem física R$ 798,94 (a prazo Correntista 475,94 e Funcionário 66,29; 99Food 179,77; iFood 76,94)
    const vendas = [
        venda('a', 3000), venda('b', 2029.22), venda('c', 2960.36), venda('d', 798.94),
        venda('x', 120, { status: 'CANCELLED' }),
    ]
    const lancamentos = [
        pagamento('a', 'Dinheiro', 3000),
        pagamento('b', 'PIX', 1200, { bank: 'PagBank' }),
        pagamento('b', 'PIX', 799.72, { bank: 'STONE' }),
        pagamento('b', 'PIX', 26, { bank: null }),
        pagamento('b', 'PIX', 3.5, { bank: '' }),
        pagamento('c', 'Crédito', 1500, { bank: 'STONE' }),
        pagamento('c', 'Débito', 1200, { bank: 'STONE' }),
        pagamento('c', 'Voucher', 260.36, { bank: 'ALELO' }),
        pagamento('d', 'Correntista', 475.94, { client_id: 'cliente' }),
        pagamento('d', 'Funcionário', 66.29, { employee_id: 'funcionaria' }),
        pagamento('d', '99Food', 179.77, { platform_code: '99FOOD' }),
        pagamento('d', 'iFood (pago no app)', 76.94, { platform_code: 'IFOOD' }),
        // A gaveta não é venda: sangria e suprimento ficam fora da conta
        pagamento(null, 'Dinheiro', 80, { is_withdrawal: true }),
        pagamento(null, 'Dinheiro', 50, { is_addition: true }),
    ]

    it('Total vendido R$ 8.788,52; Total recebido = só as formas contadas, R$ 7.989,58 (o esperado do PDV)', () => {
        const c = contaDasVendas(vendas, lancamentos, CTX)
        expect(c.vendido.total).toBe(8788.52)
        expect(c.vendido.quantidade).toBe(4)
        expect(c.recebido.total).toBe(7989.58)
        expect(c.recebido.dinheiro).toBe(3000)
        expect(c.recebido.eletronico).toBe(4989.58)
        expect(c.semContagem).toMatchObject({ total: 798.94, aPrazo: 542.23, aplicativo: 256.71 })
        expect(c.diferenca).toMatchObject({ valor: 798.94, aPrazo: 542.23, aplicativo: 256.71, caixinha: 0, semExplicacao: 0 })
    })

    it('por forma, na ordem do caixa, com as maquininhas e o "Sem maquininha" por último', () => {
        const c = contaDasVendas(vendas, lancamentos, CTX)
        expect(c.recebido.porForma.map(f => [f.forma, f.total])).toEqual([
            ['Dinheiro', 3000], ['PIX', 2029.22], ['Débito', 1200], ['Crédito', 1500], ['Voucher', 260.36],
        ])
        const pix = c.recebido.porForma.find(f => f.forma === 'PIX')!
        expect(pix.maquininhas).toEqual([{ nome: 'PagBank', total: 1200 }, { nome: 'STONE', total: 799.72 }, { nome: SEM_MAQUININHA, total: 29.5 }])
        expect(c.recebido.porForma.find(f => f.forma === 'Dinheiro')!.maquininhas).toEqual([])
    })

    it('a linha em palavras e as canceladas fora dos dois totais (D12)', () => {
        const c = contaDasVendas(vendas, lancamentos, CTX)
        expect(c.diferenca.linha).toBe('Vendido R$ 8.788,52 − a prazo R$ 542,23 − aplicativos a receber R$ 256,71 = Recebido R$ 7.989,58')
        expect(c.cancelados).toEqual({ quantidade: 1, total: 120 })
        expect(c.diferenca.canceladas).toBe('1 venda cancelada (R$ 120,00) fica fora dos dois totais.')
    })

    it('sem diferença: "Vendido e recebido batem"', () => {
        const c = contaDasVendas([venda('a', 30)], [pagamento('a', 'Dinheiro', 30)])
        expect(c.diferenca.linha).toBe('Vendido e recebido batem: R$ 30,00')
        expect(c.diferenca.canceladas).toBe('')
    })

    it('venda sem pagamento registrado aparece na linha (não some na conta)', () => {
        const c = contaDasVendas([venda('a', 30), venda('b', 50)], [pagamento('a', 'PIX', 30)])
        expect(c.diferenca.semExplicacao).toBe(50)
        expect(c.diferenca.linha).toBe('Vendido R$ 80,00 − venda sem pagamento registrado R$ 50,00 = Recebido R$ 30,00')
    })

    it('itens = total − taxas + descontos (o PDV fecha a venda assim) e o ticket médio', () => {
        const c = contaDasVendas([
            venda('a', 100, { discount: 10, delivery_fee: 5, service_fee: 9, cover_charge: 6 }),
            venda('b', 50),
        ], [])
        expect(c.vendido.itens).toBe(140)
        expect(c.vendido.taxas).toEqual({ entrega: 5, servico: 9, couvert: 6, total: 20 })
        expect(c.vendido.descontos).toBe(10)
        expect(c.vendido.ticketMedio).toBe(75)
    })
})

describe('caixa da web (loja sem PDV): o lançamento é a venda', () => {
    it('conta de R$ 182 passada no débito como R$ 200: vendido 182, caixinha 18, recebido 200', () => {
        const c = contaDasVendas([], [
            pagamento(null, 'Débito', 200, { bank: 'STONE', identification: 'Mesa 5 [Caixinha: R$ 18,00 | João]' }),
            pagamento(null, 'Dinheiro', 10, { is_tip: true, type: 'TIP' }),
        ])
        expect(c.vendido).toMatchObject({ total: 182, vendas: 0, lancadoSemVenda: 182, lancamentosSemVenda: 1 })
        expect(c.caixinha).toBe(28)
        expect(c.recebido.total).toBe(210)
        expect(c.diferenca.semExplicacao).toBe(0)
        expect(c.diferenca.linha).toBe('Vendido R$ 182,00 + caixinha R$ 28,00 = Recebido R$ 210,00')
    })

    it('a prazo lançado na web (com o cliente) é vendido e não recebido', () => {
        const c = contaDasVendas([], [pagamento(null, 'A Prazo', 75, { client_id: 'c' }), pagamento(null, 'PIX', 25)], CONTEXTO_VAZIO)
        expect(c.vendido.total).toBe(100)
        expect(c.recebido.total).toBe(25)
        expect(c.diferenca.linha).toBe('Vendido R$ 100,00 − a prazo R$ 75,00 = Recebido R$ 25,00')
    })
})

describe('item: valor, custo e margem', () => {
    it('valor = quantidade × preço − desconto do item; custo = (unidade + complementos) × quantidade', () => {
        expect(valorDoItem({ quantity: 0.604, unit_price: 26.99, discount: 0 })).toBe(16.3)
        expect(valorDoItem({ quantity: 2, unit_price: 30, discount: 5 })).toBe(55)
        expect(custoDoItem({ quantity: 2, unit_cost: 8, complements_cost: 1.5 })).toBe(19)
        expect(custoDoItem({ quantity: 2, unit_cost: null, complements_cost: null })).toBeNull()
        expect(margem(55, 19)).toEqual({ valor: 36, percentual: 65.45 })
        expect(margem(55, null)).toEqual({ valor: null, percentual: null })
        expect(margem(0, 3)).toEqual({ valor: -3, percentual: null })
    })

    it('moeda em reais com milhar', () => {
        expect(moeda(1234567.891)).toBe('R$ 1.234.567,89')
        expect(moeda(-5)).toBe('R$ 5,00')
        expect(moeda(0.1 + 0.2)).toBe('R$ 0,30')
    })
})
