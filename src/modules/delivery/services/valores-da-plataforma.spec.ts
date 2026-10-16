import { describe, expect, it, vi } from 'vitest'
import {
    gravarValoresDaPlataforma,
    lerValoresDasVendas,
    lerValoresDosPedidos,
    repasseBrutoPrevisto,
    valoresDoPedido99,
    valoresDoPedidoIfood,
    valoresParaOPdv,
} from './valores-da-plataforma'

// Valores dos pedidos das plataformas (15/10/2026). Os pedidos abaixo são os trechos de valores de pedidos REAIS da Katatau no
// diário (ifood_api_logs), sem dado do cliente; só o código da transação do Pix e o CNPJ do adquirente foram trocados.

const PAGAMENTO_PIX = (valor: number) => ({
    methods: [{ card: { brand: 'PIX' }, type: 'ONLINE', value: valor, method: 'PIX', prepaid: true, currency: 'BRL', transaction: { acquirerDocument: '00.000.000/0001-00', authorizationCode: 'E000TESTE' } }],
    pending: 0,
    prepaid: valor,
})
const TAXA_DE_SERVICO = (valor: number) => [{
    type: 'RESTAURANT_SERVICE_FEE_PRIC_ROLL_25_PER_MIN_099_MAX_399', value: valor, description: 'Taxa de serviço',
    liabilities: [{ name: 'IFOOD', percentage: 100 }],
}]
const PATROCINIO = (ifood: number, loja: number) => [
    { name: 'IFOOD', value: ifood, description: 'Incentivo do iFood' },
    { name: 'MERCHANT', value: loja, description: 'Incentivo da Loja' },
    { name: 'EXTERNAL', value: 0, description: 'Incentivo da Industria' },
    { name: 'CHAIN', value: 0, description: 'Incentivo da Rede' },
]

/** Katatau, iFood, 14/10/2026 16:17 (o exemplo da decisão do Thomás) */
const PEDIDO_IFOOD_14_10 = {
    id: '730621d7-eeec-42f9-8810-7d2e7df48597',
    orderType: 'DELIVERY',
    delivery: { deliveredBy: 'MERCHANT' },
    total: { benefits: 13.97, subTotal: 55.9, deliveryFee: 9.99, orderAmount: 53.32, additionalFees: 1.4 },
    benefits: [{ value: 13.97, target: 'CART', campaign: { name: 'CLUBE_IFOOD' }, sponsorshipValues: PATROCINIO(8.97, 5) }],
    additionalFees: TAXA_DE_SERVICO(1.4),
    payments: PAGAMENTO_PIX(53.32),
}

/** Katatau, iFood, 12/10/2026: "Tudo por R$ 9,90" (loja 9,99 + iFood 13,71) */
const PEDIDO_IFOOD_12_10 = {
    id: 'a93983e0-4fb6-46b7-99e3-9d7cdf1cccf6',
    orderType: 'DELIVERY',
    delivery: { deliveredBy: 'MERCHANT' },
    total: { benefits: 23.7, subTotal: 33.6, deliveryFee: 0, orderAmount: 10.89, additionalFees: 0.99 },
    benefits: [{ value: 23.7, target: 'ITEM', targetId: '1', sponsorshipValues: PATROCINIO(13.71, 9.99) }],
    additionalFees: TAXA_DE_SERVICO(0.99),
    payments: PAGAMENTO_PIX(10.89),
}

describe('iFood: pedido completo → valores', () => {
    it('o exemplo de 14/10: itens 55,90, frete 9,99, desconto 13,97 (iFood 8,97 + loja 5,00), taxa 1,40, pagou 53,32 → 60,89', () => {
        const v = valoresDoPedidoIfood(PEDIDO_IFOOD_14_10)!
        expect(v).toMatchObject({
            platform: 'IFOOD',
            external_id: '730621d7-eeec-42f9-8810-7d2e7df48597',
            items_value: 55.9,
            delivery_fee: 9.99,
            service_fee: 1.4,
            discount_total: 13.97,
            discount_store: 5,
            discount_platform: 8.97,
            discount_other: 0,
            customer_paid: 53.32,
            paid_online: true,
            own_delivery: true,
            expected_gross: 60.89,
        })
        // o trecho original, exatamente como veio
        expect(v.raw.total).toEqual(PEDIDO_IFOOD_14_10.total)
        expect(v.raw.benefits).toEqual(PEDIDO_IFOOD_14_10.benefits)
        expect(v.raw.additionalFees).toEqual(PEDIDO_IFOOD_14_10.additionalFees)
        expect(v.raw.payments).toEqual(PEDIDO_IFOOD_14_10.payments)
        expect(v.raw).toMatchObject({ orderType: 'DELIVERY', deliveredBy: 'MERCHANT' })
    })

    it('o exemplo de 12/10: itens 33,60 − desconto da loja 9,99 = 23,61 (o iFood bancou 13,71; cliente pagou 10,89)', () => {
        const v = valoresDoPedidoIfood(PEDIDO_IFOOD_12_10)!
        expect(v).toMatchObject({ items_value: 33.6, discount_store: 9.99, discount_platform: 13.71, service_fee: 0.99, customer_paid: 10.89, expected_gross: 23.61 })
    })

    it('frete grátis pago pelo iFood (alvo DELIVERY_FEE) volta para a loja como incentivo do iFood', () => {
        const v = valoresDoPedidoIfood({
            id: '33ba8ddf-0add-4ed6-baeb-ae361668c118', orderType: 'DELIVERY', delivery: { deliveredBy: 'MERCHANT' },
            total: { benefits: 13.99, subTotal: 42.6, deliveryFee: 5.99, orderAmount: 35.59, additionalFees: 0.99 },
            benefits: [
                { value: 8, target: 'ITEM', sponsorshipValues: PATROCINIO(0, 8) },
                { value: 5.99, target: 'DELIVERY_FEE', sponsorshipValues: PATROCINIO(5.99, 0) },
            ],
            additionalFees: TAXA_DE_SERVICO(0.99),
            payments: PAGAMENTO_PIX(35.59),
        })!
        expect(v).toMatchObject({ discount_store: 8, discount_platform: 5.99, expected_gross: 40.59 })
    })

    it('entrega do iFood: o frete não é da loja; pago na entrega: não é online', () => {
        const v = valoresDoPedidoIfood({
            ...PEDIDO_IFOOD_14_10,
            delivery: { deliveredBy: 'IFOOD' },
            payments: { methods: [{ type: 'OFFLINE', method: 'CASH', value: 53.32 }], pending: 53.32, prepaid: 0 },
        })!
        expect(v.own_delivery).toBe(false)
        expect(v.paid_online).toBe(false)
        expect(v.expected_gross).toBe(50.9) // 55,90 − 5,00
    })

    it('retirada: sem entrega (own_delivery nulo); desconto sem a divisão de quem pagou conta como da loja', () => {
        const v = valoresDoPedidoIfood({
            id: 'x', orderType: 'TAKEOUT',
            total: { benefits: 4, subTotal: 30, deliveryFee: 0, orderAmount: 26.99, additionalFees: 0.99 },
            benefits: [{ value: 4, target: 'CART' }],
            payments: PAGAMENTO_PIX(26.99),
        })!
        expect(v).toMatchObject({ own_delivery: null, discount_store: 4, discount_platform: 0, expected_gross: 26 })
    })

    it('indústria e rede vão para "outros" e não saem do repasse', () => {
        const v = valoresDoPedidoIfood({
            ...PEDIDO_IFOOD_14_10,
            benefits: [{ value: 13.97, sponsorshipValues: [{ name: 'MERCHANT', value: 5 }, { name: 'IFOOD', value: 6.97 }, { name: 'EXTERNAL', value: 2 }] }],
        })!
        expect(v).toMatchObject({ discount_store: 5, discount_platform: 6.97, discount_other: 2, expected_gross: 60.89 })
    })

    it('sem id ou sem objeto: nada', () => {
        expect(valoresDoPedidoIfood(null)).toBeNull()
        expect(valoresDoPedidoIfood({ total: {} })).toBeNull()
    })
})

/** Katatau, 99Food, 13/10/2026: pago na entrega, entrega da loja, três promoções (loja 5,98 + 99 13,91 + frete da loja 5,99) */
const PEDIDO_99_NA_ENTREGA = {
    order_id: '5764690987620304994',
    price: {
        real_price: 2881, order_price: 3380,
        others_fees: { service_price: 99, coupon_discount: 1197, total_tip_money: 0, small_order_price: 0 },
        refund_price: 0, delivery_price: 0, items_discount: 1989, real_pay_price: 1490, delivery_discount: 599,
        customer_need_paying_money: 1490, store_charged_delivery_price: 599,
    },
    promotions: [
        { promo_type: 2, promo_discount: 598, shop_subside_price: 598 },
        { promo_type: 11, promo_discount: 1391, shop_subside_price: 0 },
        { promo_type: 3, promo_discount: 599, shop_subside_price: 599 },
    ],
    delivery_type: 2, fulfillment_mode: 0, pay_method: 2, pay_type: 2,
}

/** Katatau, 99Food, 13/10/2026: pago no app, sem promoção, com complemento de pedido mínimo (meal_top_up_price) */
const PEDIDO_99_NO_APP = {
    order_id: '5764690831789328506',
    price: {
        real_price: 2609, order_price: 1990,
        others_fees: { service_price: 110, coupon_discount: 0, total_tip_money: 0, meal_top_up_price: 10, small_order_price: 0 },
        refund_price: 0, delivery_price: 499, items_discount: 0, real_pay_price: 2609, delivery_discount: 0,
        customer_need_paying_money: 2609, store_charged_delivery_price: 499,
    },
    promotions: null,
    delivery_type: 2, fulfillment_mode: 0, pay_method: 1, pay_type: 1,
}

describe('99Food: orderNew → valores (centavos → reais)', () => {
    it('pago na entrega com promoções: o desconto da loja é a soma de shop_subside_price; o resto é da 99', () => {
        const v = valoresDoPedido99(PEDIDO_99_NA_ENTREGA, '5764690987620304994')!
        expect(v).toMatchObject({
            platform: '99FOOD',
            external_id: '5764690987620304994',
            items_value: 33.8,
            delivery_fee: 5.99,
            service_fee: 0.99,
            discount_total: 25.88,
            discount_store: 11.97,
            discount_platform: 13.91,
            discount_other: 0,
            customer_paid: 14.9,
            paid_online: false,
            own_delivery: true,
            expected_gross: 27.82, // 33,80 + 5,99 − 11,97 (= real_price 28,81 − taxa de serviço 0,99)
        })
        expect(v.raw.price).toEqual(PEDIDO_99_NA_ENTREGA.price)
        expect(v.raw.promotions).toEqual(PEDIDO_99_NA_ENTREGA.promotions)
    })

    it('pago no app sem promoção: a taxa soma o complemento do pedido mínimo; sem lista de promoções vale o coupon_discount', () => {
        const v = valoresDoPedido99(PEDIDO_99_NO_APP)!
        expect(v).toMatchObject({
            external_id: '5764690831789328506', items_value: 19.9, delivery_fee: 4.99, service_fee: 1.2,
            discount_total: 0, discount_store: 0, discount_platform: 0, customer_paid: 26.09, paid_online: true, expected_gross: 24.89,
        })
    })

    it('entrega da 99 (delivery_type 1): o frete não é da loja; retirada: own_delivery nulo', () => {
        expect(valoresDoPedido99({ ...PEDIDO_99_NO_APP, delivery_type: 1 })!).toMatchObject({ own_delivery: false, expected_gross: 19.9 })
        expect(valoresDoPedido99({ ...PEDIDO_99_NO_APP, fulfillment_mode: 1 })!.own_delivery).toBeNull()
    })

    it('pedido do Sandbox (só os totais): sem saber o desconto da loja não há repasse previsto', () => {
        const v = valoresDoPedido99({ order_id: '1', price: { real_price: 2500, order_price: 2500, refund_price: 0, real_pay_price: 2500 }, delivery_type: 1, pay_method: 0 })!
        expect(v).toMatchObject({ items_value: 25, customer_paid: 25, discount_store: null, expected_gross: null, paid_online: false })
    })

    it('sem price: nada', () => {
        expect(valoresDoPedido99({ order_id: '1' })).toBeNull()
    })
})

describe('repasse bruto previsto', () => {
    it('itens + frete (da loja ou sem saber) − desconto da loja; sem itens ou sem o desconto da loja = null', () => {
        expect(repasseBrutoPrevisto({ items_value: 55.9, delivery_fee: 9.99, discount_store: 5, own_delivery: null })).toBe(60.89)
        expect(repasseBrutoPrevisto({ items_value: 55.9, delivery_fee: 9.99, discount_store: 5, own_delivery: false })).toBe(50.9)
        expect(repasseBrutoPrevisto({ items_value: null, delivery_fee: 9.99, discount_store: 5, own_delivery: true })).toBeNull()
        expect(repasseBrutoPrevisto({ items_value: 10, delivery_fee: 0, discount_store: null, own_delivery: true })).toBeNull()
    })
})

describe('banco: grava e lê sem nunca derrubar o pedido', () => {
    it('grava pelo pedido (upsert), sem tocar nos *_real', async () => {
        const upsert = vi.fn(async () => ({}))
        const ok = await gravarValoresDaPlataforma({ pedidoValoresPlataforma: { upsert } }, 35, valoresDoPedidoIfood(PEDIDO_IFOOD_14_10))
        expect(ok).toBe(true)
        const arg = (upsert.mock.calls[0] as any[])[0]
        expect(arg.where).toEqual({ pedido_id: 35 })
        expect(arg.create).toMatchObject({ pedido_id: 35, platform: 'IFOOD', expected_gross: 60.89 })
        expect(Object.keys(arg.update).some(k => k.endsWith('_real'))).toBe(false)
    })

    it('tabela que não existe (antes do Sincronizar): não grava, não lança, e a leitura volta vazia', async () => {
        const falha = vi.fn(async () => { throw Object.assign(new Error('The table `pedido_valores_plataforma` does not exist'), { code: 'P2021' }) })
        const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
        expect(await gravarValoresDaPlataforma({ pedidoValoresPlataforma: { upsert: falha } }, 1, valoresDoPedidoIfood(PEDIDO_IFOOD_14_10))).toBe(false)
        expect((await lerValoresDosPedidos({ pedidoValoresPlataforma: { findMany: falha } }, [1])).size).toBe(0)
        expect((await lerValoresDasVendas({ pedidoValoresPlataforma: { findMany: falha } }, ['v1'])).size).toBe(0)
        // banco de mentira sem a tabela (testes antigos): também vazio
        expect((await lerValoresDosPedidos({}, [1])).size).toBe(0)
        erro.mockRestore()
        aviso.mockRestore()
    })

    it('lê as vendas pelo uuid do pedido, com o total que o PDV recebeu', async () => {
        const findMany = vi.fn(async () => [{ pedido_id: 35, platform: 'IFOOD', expected_gross: 60.89, pedido: { uuid: 'venda-35', valor_final: 53.32 } }])
        const mapa = await lerValoresDasVendas({ pedidoValoresPlataforma: { findMany } }, ['venda-35', 'venda-35', ''])
        expect((findMany.mock.calls[0] as any[])[0].where).toEqual({ pedido: { uuid: { in: ['venda-35'] } } })
        expect(mapa.get('venda-35')).toMatchObject({ expected_gross: 60.89, valor_do_pedido: 53.32 })
    })

    it('para o PDV: as 14 chaves do contrato, nem mais nem menos', () => {
        const v = valoresDoPedidoIfood(PEDIDO_IFOOD_14_10)!
        const pdv = valoresParaOPdv({ ...v, pedido_id: 35, raw: v.raw } as any)
        expect(Object.keys(pdv).sort()).toEqual([
            'customer_paid', 'delivery_fee', 'discount_other', 'discount_platform', 'discount_store', 'discount_total', 'expected_gross',
            'external_id', 'items_value', 'own_delivery', 'paid_online', 'platform', 'raw', 'service_fee',
        ])
    })
})
