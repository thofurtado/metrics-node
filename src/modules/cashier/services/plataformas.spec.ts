import { describe, expect, it } from 'vitest'
import {
    acharSetorPeloNome,
    basesDaVendaDePlataforma,
    codigoDePlataforma,
    contaDaFormaPix,
    dataDoRepasse,
    diaDeBrasilia,
    montarFormasDaPlataforma,
    planoDasPlataformas,
    saiDaGaveta,
    setorDaDespesa,
    textoDoDetalheDoRepasse,
    vencimentoDoDia,
    vendaDePlataforma,
    type LancamentoDoCaixa,
    type PlataformaCadastrada,
    type ValoresDaVenda,
} from './plataformas'

// Plano das plataformas (15/10/2026): data do repasse, qual venda é de plataforma, repasse/comissão e despesa no Pix.

const IFOOD: PlataformaCadastrada = {
    id: 'p-ifood', code: 'IFOOD', name: 'iFood', account_id: null,
    commission_own_delivery_pct: 12, commission_platform_delivery_pct: 23, online_payment_fee_pct: 3.2, payout_weeks_after: 4,
}
const NOVENTA_E_NOVE: PlataformaCadastrada = {
    id: 'p-99', code: '99FOOD', name: '99Food', account_id: 'conta-pagbank',
    commission_own_delivery_pct: 10.9, commission_platform_delivery_pct: 8.9, online_payment_fee_pct: 3.2, payout_weeks_after: 1,
}

const formas = montarFormasDaPlataforma(
    [{ name: 'Pago na plataforma', kind: 'PLATAFORMA' }, { name: 'Pix', kind: null }],
    [{ name: 'iFood', platform: { code: 'IFOOD' } }, { name: '99Food', platform: { code: '99FOOD' } }, { name: 'Permuta', platform: null }],
)

function venda(parcial: Partial<LancamentoDoCaixa>): LancamentoDoCaixa {
    return { id: 'l1', amount: 100, payment_method: 'Dinheiro', type: 'SALE', is_withdrawal: false, is_addition: false, sale_id: null, ...parcial }
}

describe('data do repasse (plano 2.1)', () => {
    it('99Food (1 semana): a quarta logo depois do domingo da semana da venda', () => {
        // semana de segunda 12/10 a domingo 18/10/2026
        expect(dataDoRepasse('2026-10-12', 1)).toBe('2026-10-21')
        expect(dataDoRepasse('2026-10-15', 1)).toBe('2026-10-21')
        expect(dataDoRepasse('2026-10-18', 1)).toBe('2026-10-21') // domingo ainda é da mesma semana
        expect(dataDoRepasse('2026-10-19', 1)).toBe('2026-10-28') // segunda já é a semana seguinte
    })

    it('iFood (4 semanas): a mesma quarta mais 3 semanas', () => {
        expect(dataDoRepasse('2026-10-13', 4)).toBe('2026-11-11')
        expect(dataDoRepasse('2026-10-14', 4)).toBe('2026-11-11')
    })

    it('vira o mês e o ano certo', () => {
        expect(dataDoRepasse('2026-12-30', 1)).toBe('2027-01-06') // quarta 30/12: domingo 03/01, quarta 06/01
        expect(dataDoRepasse('2026-02-27', 4)).toBe('2026-03-25')
    })

    it('menos de 1 semana conta como 1', () => {
        expect(dataDoRepasse('2026-10-15', 0)).toBe('2026-10-21')
    })

    it('o vencimento é meio-dia de Brasília e volta para o mesmo dia', () => {
        expect(vencimentoDoDia('2026-11-11').toISOString()).toBe('2026-11-11T15:00:00.000Z')
        expect(diaDeBrasilia(vencimentoDoDia('2026-11-11'))).toBe('2026-11-11')
        expect(diaDeBrasilia(new Date('2026-11-12T02:30:00.000Z'))).toBe('2026-11-11') // 23:30 de Brasília
    })
})

describe('código da plataforma', () => {
    it('só letras e números em maiúsculas', () => {
        expect(codigoDePlataforma('iFood')).toBe('IFOOD')
        expect(codigoDePlataforma(' 99Food ')).toBe('99FOOD')
        expect(codigoDePlataforma('')).toBeNull()
        expect(codigoDePlataforma(null)).toBeNull()
    })
})

describe('qual venda é de plataforma (plano 2.2)', () => {
    const codigos = new Set(['IFOOD', '99FOOD'])

    it('forma Plataforma pelo identificador: paga no app, plataforma do identificador', () => {
        expect(vendaDePlataforma(venda({ payment_method: 'iFood' }), formas, null, codigos))
            .toEqual({ codigo: 'IFOOD', pagoNoApp: true, entregaPropria: true })
    })

    it('forma Plataforma sem identificador: a plataforma vem do PDV', () => {
        expect(vendaDePlataforma(venda({ payment_method: 'Pago na plataforma', platform_code: '99FOOD', platform_own_delivery: false }), formas, null, codigos))
            .toEqual({ codigo: '99FOOD', pagoNoApp: true, entregaPropria: false })
    })

    it('textos antigos "(pago no app)"', () => {
        expect(vendaDePlataforma(venda({ payment_method: 'iFood (pago no app)' }), formas, null, codigos)).toMatchObject({ codigo: 'IFOOD', pagoNoApp: true })
        expect(vendaDePlataforma(venda({ payment_method: '99Food (pago no app)' }), formas, null, codigos)).toMatchObject({ codigo: '99FOOD', pagoNoApp: true })
    })

    it('pedido da plataforma pago em dinheiro (D4): é de plataforma, mas não pago no app', () => {
        expect(vendaDePlataforma(venda({ payment_method: 'Dinheiro', platform_code: 'IFOOD', platform_own_delivery: true }), formas, null, codigos))
            .toEqual({ codigo: 'IFOOD', pagoNoApp: false, entregaPropria: true })
    })

    it('venda antiga sem o código: pela plataforma do pedido, só se for código de plataforma', () => {
        expect(vendaDePlataforma(venda({ sale_id: 'v1' }), formas, '99FOOD', codigos)).toMatchObject({ codigo: '99FOOD', pagoNoApp: false })
        expect(vendaDePlataforma(venda({ sale_id: 'v1' }), formas, 'WEB', codigos)).toBeNull()
        expect(vendaDePlataforma(venda({ sale_id: 'v1' }), formas, null, codigos)).toBeNull()
    })

    it('venda comum, saída, suprimento e identificador sem plataforma não são de plataforma', () => {
        expect(vendaDePlataforma(venda({ payment_method: 'Crédito' }), formas, null, codigos)).toBeNull()
        expect(vendaDePlataforma(venda({ payment_method: 'Permuta' }), formas, null, codigos)).toBeNull()
        expect(vendaDePlataforma(venda({ payment_method: 'iFood (pago no app)', is_withdrawal: true }), formas, null, codigos)).toBeNull()
        expect(vendaDePlataforma(venda({ payment_method: 'iFood (pago no app)', type: 'ADDITION' }), formas, null, codigos)).toBeNull()
    })
})

describe('repasse e comissão por plataforma (plano 2.2)', () => {
    const ctx = { plataformas: [IFOOD, NOVENTA_E_NOVE], formas, plataformaDoPedido: new Map<string, string>() }

    it('receita = pagas no app (valor cheio); comissão = entrega de todas + taxa online das pagas no app', () => {
        const plano = planoDasPlataformas([
            venda({ id: 'a', amount: 100, payment_method: 'iFood (pago no app)' }), // loja entregou (sem informação)
            venda({ id: 'b', amount: 50, payment_method: 'iFood', platform_code: 'IFOOD', platform_own_delivery: false }), // entregador do iFood
            venda({ id: 'c', amount: 40, payment_method: 'Dinheiro', platform_code: 'IFOOD', platform_own_delivery: true }), // pago em dinheiro
            venda({ id: 'd', amount: 30, payment_method: 'Crédito' }), // venda comum
        ], ctx, '2026-10-15')

        expect(plano.grupos).toHaveLength(1)
        const g = plano.grupos[0]
        expect(g.plataforma.id).toBe('p-ifood')
        expect(g.dataRepasse).toBe('2026-11-11')
        expect(g.receita).toBe(150)
        // 100×12% + 50×23% + 40×12% + (100+50)×3,2% = 12 + 11,5 + 4,8 + 4,8
        expect(g.comissao).toBe(33.1)
        expect(g.vendas).toBe(3)
        expect(g.vendasNoApp).toBe(2)
        expect([...plano.noRepasse].sort()).toEqual(['a', 'b'])
        expect(plano.avisos).toEqual([])
    })

    it('99Food: arredonda em centavos e repassa na quarta seguinte', () => {
        const plano = planoDasPlataformas([
            venda({ id: 'a', amount: 29.38, payment_method: '99Food (pago no app)' }),
            venda({ id: 'b', amount: 26.09, payment_method: '99Food (pago no app)' }),
        ], ctx, '2026-10-13')
        const g = plano.grupos[0]
        expect(g.dataRepasse).toBe('2026-10-21')
        expect(g.receita).toBe(55.47)
        expect(g.comissao).toBe(7.82) // 55,47 × 14,1% = 7,82127
    })

    it('venda antiga em dinheiro de pedido da plataforma: só a comissão', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 57.83, sale_id: 'v1' })],
            { ...ctx, plataformaDoPedido: new Map([['v1', '99FOOD']]) }, '2026-10-14')
        expect(plano.grupos[0]).toMatchObject({ receita: 0, comissao: 6.3, vendasNoApp: 0 })
        expect(plano.noRepasse.size).toBe(0)
    })

    it('plataforma sem cadastro: fica como antes e avisa', () => {
        const plano = planoDasPlataformas([
            venda({ id: 'a', amount: 26.34, payment_method: '99Food (pago no app)' }),
            venda({ id: 'b', amount: 10, payment_method: 'Dinheiro', platform_code: '99FOOD' }),
        ], { ...ctx, plataformas: [IFOOD] }, '2026-10-14')
        expect(plano.grupos).toEqual([])
        expect(plano.noRepasse.size).toBe(0)
        expect(plano.avisos).toHaveLength(1)
        expect(plano.avisos[0]).toContain('Cadastre a plataforma 99Food')
        expect(plano.avisos[0]).toContain('2 venda(s)')
        expect(plano.avisos[0]).toContain('R$ 36,34')
    })

    it('paga no app sem dizer a plataforma: fica como antes e avisa', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 20, payment_method: 'Pago na plataforma' })], ctx, '2026-10-14')
        expect(plano.grupos).toEqual([])
        expect(plano.noRepasse.size).toBe(0)
        expect(plano.avisos[0]).toContain('não dizem de qual plataforma')
    })
})

describe('despesa do caixa com setor e forma (plano 2.4)', () => {
    it('a saída no Pix não sai da gaveta', () => {
        expect(saiDaGaveta({ is_withdrawal: true, payment_method: 'Pix' })).toBe(false)
        expect(saiDaGaveta({ is_withdrawal: true, payment_method: 'Dinheiro' })).toBe(true)
        expect(saiDaGaveta({ is_withdrawal: true, payment_method: null })).toBe(true)
        expect(saiDaGaveta({ is_withdrawal: false, payment_method: 'Dinheiro' })).toBe(false)
    })

    it('a conta da forma Pix: a chamada "Pix", nunca a forma Plataforma; sem conta = null', () => {
        expect(contaDaFormaPix([
            { name: 'Pix maquininha', kind: null, account_id: 'stone' },
            { name: 'PIX', kind: null, account_id: 'pagbank' },
        ])).toBe('pagbank')
        expect(contaDaFormaPix([{ name: 'Pix', kind: null, account_id: null }])).toBeNull()
        expect(contaDaFormaPix([{ name: 'Pix da plataforma', kind: 'PLATAFORMA', account_id: 'x' }])).toBeNull()
        expect(contaDaFormaPix([{ name: 'Pix', kind: null, account_id: 'x', active: false }])).toBeNull()
    })

    it('setor da despesa: a Categoria do PDV ou "Motoboy" para o texto antigo', () => {
        expect(setorDaDespesa(' motoboy ', 'qualquer')).toBe('Motoboy')
        expect(setorDaDespesa('Gás', null)).toBe('Gás')
        expect(setorDaDespesa(null, 'SaidaOperacional: [Motoboy] Acerto de Henrique: 12 entregas + 1 diária')).toBe('Motoboy')
        expect(setorDaDespesa(undefined, 'SaidaOperacional: gás')).toBeNull()
    })

    it('acha o setor sem diferenciar acento nem maiúscula', () => {
        const setores = [{ id: '1', name: 'Taxas de Plataforma' }, { id: '2', name: 'Motoboy' }]
        expect(acharSetorPeloNome(setores, 'taxas de plataforma')?.id).toBe('1')
        expect(acharSetorPeloNome(setores, 'MOTOBÓY')?.id).toBe('2')
        expect(acharSetorPeloNome(setores, 'Fixas')).toBeNull()
    })
})

// ---------------------------------------------------------------------------------------------------------------
// Valores do pedido da plataforma na conferência (15/10/2026, "conta corrente da plataforma"). Os valores são dos pedidos
// reais da Katatau (os mesmos de delivery/services/valores-da-plataforma.spec.ts).
// ---------------------------------------------------------------------------------------------------------------

/** iFood 14/10 16:17: itens 55,90 + frete 9,99 + taxa 1,40 − desconto 13,97 (iFood 8,97 + loja 5,00) = pagou 53,32 */
const IFOOD_14_10: ValoresDaVenda = {
    platform: 'IFOOD', items_value: 55.9, delivery_fee: 9.99, service_fee: 1.4, discount_store: 5, discount_platform: 8.97,
    discount_other: 0, customer_paid: 53.32, paid_online: true, own_delivery: true, expected_gross: 60.89, valor_do_pedido: 53.32,
}
/** iFood 12/10: "Tudo por R$ 9,90": itens 33,60 − loja 9,99 − iFood 13,71 + taxa 0,99 = pagou 10,89; parte da loja 23,61 */
const IFOOD_12_10: ValoresDaVenda = {
    platform: 'IFOOD', items_value: 33.6, delivery_fee: 0, service_fee: 0.99, discount_store: 9.99, discount_platform: 13.71,
    discount_other: 0, customer_paid: 10.89, paid_online: true, own_delivery: true, expected_gross: 23.61, valor_do_pedido: 10.89,
}
/** 99Food 13/10: a venda é o real_price 28,81 (já com o incentivo da 99 de 13,91); cliente pagou 14,90; parte da loja 27,82 */
const NOVENTA_E_NOVE_13_10: ValoresDaVenda = {
    platform: '99FOOD', items_value: 33.8, delivery_fee: 5.99, service_fee: 0.99, discount_store: 11.97, discount_platform: 13.91,
    discount_other: 0, customer_paid: 14.9, paid_online: true, own_delivery: true, expected_gross: 27.82, valor_do_pedido: 28.81,
}

describe('base de cálculo de uma venda de plataforma (função única, 15/10/2026)', () => {
    it('sem os valores da plataforma: como antes (tudo sobre o valor da venda)', () => {
        expect(basesDaVendaDePlataforma(53.32, { pagoNoApp: true, entregaPropria: true }, null)).toMatchObject({
            repasse: 53.32, baseComissao: 53.32, baseTaxaOnline: 53.32, comValores: false,
        })
        expect(basesDaVendaDePlataforma(40, { pagoNoApp: false, entregaPropria: false }, undefined)).toMatchObject({
            repasse: 0, baseComissao: 40, baseTaxaOnline: 0, entregaPropria: false, comValores: false,
        })
        // linha sem o repasse previsto (a plataforma não disse o desconto da loja): também como antes
        expect(basesDaVendaDePlataforma(25, { pagoNoApp: true, entregaPropria: true }, { ...IFOOD_14_10, expected_gross: null }).comValores).toBe(false)
    })

    it('pago no app: repasse e comissão sobre expected_gross; taxa online sobre o que o cliente pagou', () => {
        const b = basesDaVendaDePlataforma(53.32, { pagoNoApp: true, entregaPropria: true }, IFOOD_14_10)
        expect(b).toMatchObject({ repasse: 60.89, baseComissao: 60.89, baseTaxaOnline: 53.32, comValores: true })
        expect(b.incentivo).toBeCloseTo(8.97, 6)
        expect(b.taxaDeServico).toBeCloseTo(1.4, 6)
        expect(b.outraDiferenca).toBeCloseTo(0, 6)
    })

    it('pago na entrega: só o desconto que a plataforma bancou é receita; comissão sobre expected_gross; sem taxa online', () => {
        const b = basesDaVendaDePlataforma(53.32, { pagoNoApp: false, entregaPropria: true }, { ...IFOOD_14_10, paid_online: false })
        expect(b).toMatchObject({ repasse: 8.97, baseComissao: 60.89, baseTaxaOnline: 0, comValores: true, incentivo: 8.97 })
    })

    it('99: a venda já tem o incentivo da 99, então o texto não diz "inclui incentivo"; só tira a taxa de serviço', () => {
        const b = basesDaVendaDePlataforma(28.81, { pagoNoApp: true, entregaPropria: true }, NOVENTA_E_NOVE_13_10)
        expect(b).toMatchObject({ repasse: 27.82, baseComissao: 27.82, baseTaxaOnline: 14.9, incentivo: 0 })
        expect(b.taxaDeServico).toBeCloseTo(0.99, 6)
        expect(b.outraDiferenca).toBeCloseTo(0, 6)
    })

    it('quem entregou: o que a plataforma disse vale mais que o PDV; sem isso, o PDV', () => {
        expect(basesDaVendaDePlataforma(10, { pagoNoApp: true, entregaPropria: true }, { ...IFOOD_14_10, own_delivery: false }).entregaPropria).toBe(false)
        expect(basesDaVendaDePlataforma(10, { pagoNoApp: true, entregaPropria: false }, { ...IFOOD_14_10, own_delivery: null }).entregaPropria).toBe(false)
    })
})

describe('repasse e comissão com os valores da plataforma (15/10/2026)', () => {
    const ctx = (valores: [string, ValoresDaVenda][]) => ({
        plataformas: [IFOOD, NOVENTA_E_NOVE], formas, plataformaDoPedido: new Map<string, string>(), valoresDaVenda: new Map(valores),
    })

    it('o exemplo de 14/10, pago no app: repasse 60,89 (não 53,32) e o texto explica a diferença', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 53.32, payment_method: 'iFood (pago no app)', sale_id: 'v35' })],
            ctx([['v35', IFOOD_14_10]]), '2026-10-14')
        const g = plano.grupos[0]
        expect(g.receita).toBe(60.89)
        // 60,89 × 12% + 53,32 × 3,2% = 7,3068 + 1,70624
        expect(g.comissao).toBe(9.01)
        expect([...plano.noRepasse]).toEqual(['a'])
        expect(textoDoDetalheDoRepasse('iFood', g.detalhe)).toBe(
            'valores do iFood em 1 venda(s) paga(s) no app: vendas R$ 53,32, repasse R$ 60,89; inclui incentivo do iFood R$ 8,97; sem a taxa de serviço R$ 1,40')
        expect(plano.avisos).toEqual([])
    })

    it('o exemplo de 12/10, pago no app: parte da loja 23,61 (a venda no caixa é 10,89)', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 10.89, payment_method: 'iFood', sale_id: 'v9' })],
            ctx([['v9', IFOOD_12_10]]), '2026-10-12')
        const g = plano.grupos[0]
        expect(g.receita).toBe(23.61)
        expect(g.comissao).toBe(3.18) // 23,61 × 12% + 10,89 × 3,2% = 2,8332 + 0,34848
        expect(textoDoDetalheDoRepasse('iFood', g.detalhe)).toBe(
            'valores do iFood em 1 venda(s) paga(s) no app: vendas R$ 10,89, repasse R$ 23,61; inclui incentivo do iFood R$ 13,71; sem a taxa de serviço R$ 0,99')
    })

    it('pago na entrega (dinheiro): o dinheiro fica no caixa; do lado do iFood, receita 8,97 (o incentivo) e a comissão', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 53.32, payment_method: 'Dinheiro', platform_code: 'IFOOD', sale_id: 'v35' })],
            ctx([['v35', { ...IFOOD_14_10, paid_online: false }]]), '2026-10-14')
        const g = plano.grupos[0]
        expect(g).toMatchObject({ receita: 8.97, comissao: 7.31, vendasNoApp: 0 }) // 60,89 × 12% = 7,3068; sem taxa online
        expect(plano.noRepasse.size).toBe(0) // o dinheiro segue o caminho de sempre
        expect(textoDoDetalheDoRepasse('iFood', g.detalhe)).toBe('incentivo do iFood R$ 8,97 de 1 venda(s) paga(s) na entrega')
    })

    it('pago na entrega sem desconto da plataforma: nenhuma receita, só a comissão (saldo negativo do lado do iFood)', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 53.32, payment_method: 'Crédito', platform_code: 'IFOOD', sale_id: 'v1' })],
            ctx([['v1', { ...IFOOD_14_10, discount_platform: 0, paid_online: false }]]), '2026-10-14')
        expect(plano.grupos[0]).toMatchObject({ receita: 0, comissao: 7.31 })
    })

    it('99: repasse 27,82 (sem a taxa de serviço), taxa online sobre os 14,90 que o cliente pagou', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 28.81, payment_method: '99Food (pago no app)', sale_id: 'v13' })],
            ctx([['v13', NOVENTA_E_NOVE_13_10]]), '2026-10-13')
        const g = plano.grupos[0]
        expect(g.receita).toBe(27.82)
        expect(g.comissao).toBe(3.51) // 27,82 × 10,9% + 14,90 × 3,2% = 3,03238 + 0,4768
        expect(textoDoDetalheDoRepasse('99Food', g.detalhe)).toBe(
            'valores da 99Food em 1 venda(s) paga(s) no app: vendas R$ 28,81, repasse R$ 27,82; sem a taxa de serviço R$ 0,99')
    })

    it('venda com e sem os valores no mesmo caixa: a antiga continua pelo valor cheio', () => {
        const plano = planoDasPlataformas([
            venda({ id: 'a', amount: 53.32, payment_method: 'iFood (pago no app)', sale_id: 'v35' }),
            venda({ id: 'b', amount: 20, payment_method: 'iFood (pago no app)', sale_id: 'antiga' }),
        ], ctx([['v35', IFOOD_14_10]]), '2026-10-14')
        const g = plano.grupos[0]
        expect(g.receita).toBe(80.89)
        expect(g.detalhe.vendasNoApp).toBe(1)
        expect(g.vendasNoApp).toBe(2)
    })

    it('venda paga em dois lançamentos: cada um leva a sua parte, o repasse soma o expected_gross uma vez só', () => {
        const plano = planoDasPlataformas([
            venda({ id: 'a', amount: 30, payment_method: 'iFood', sale_id: 'v35' }),
            venda({ id: 'b', amount: 23.32, payment_method: 'iFood', sale_id: 'v35' }),
        ], ctx([['v35', IFOOD_14_10]]), '2026-10-14')
        expect(plano.grupos[0].receita).toBe(60.89)
        expect(plano.grupos[0].detalhe.incentivo).toBe(8.97)
    })

    it('entregador do iFood (pela plataforma): comissão da entrega do iFood e o frete fora do repasse', () => {
        const valores = { ...IFOOD_14_10, own_delivery: false, expected_gross: 50.9 }
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 53.32, payment_method: 'iFood', sale_id: 'v35', platform_own_delivery: true })],
            ctx([['v35', valores]]), '2026-10-14')
        const g = plano.grupos[0]
        expect(g.receita).toBe(50.9)
        expect(g.comissao).toBe(13.41) // 50,90 × 23% + 53,32 × 3,2% = 11,707 + 1,70624
        expect(textoDoDetalheDoRepasse('iFood', g.detalhe)).toContain('sem o frete da entrega do iFood R$ 9,99')
    })

    it('o caixa registrou a forma diferente da plataforma: vale o caixa, e avisa', () => {
        const plano = planoDasPlataformas([venda({ id: 'a', amount: 53.32, payment_method: 'Dinheiro', platform_code: 'IFOOD', sale_id: 'v35' })],
            ctx([['v35', IFOOD_14_10]]), '2026-10-14')
        expect(plano.grupos[0].receita).toBe(8.97)
        expect(plano.avisos[0]).toContain('1 venda(s) do iFood com a forma diferente')
    })
})
