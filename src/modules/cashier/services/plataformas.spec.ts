import { describe, expect, it } from 'vitest'
import {
    acharSetorPeloNome,
    codigoDePlataforma,
    contaDaFormaPix,
    dataDoRepasse,
    diaDeBrasilia,
    montarFormasDaPlataforma,
    planoDasPlataformas,
    saiDaGaveta,
    setorDaDespesa,
    vencimentoDoDia,
    vendaDePlataforma,
    type LancamentoDoCaixa,
    type PlataformaCadastrada,
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
