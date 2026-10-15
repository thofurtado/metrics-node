import { describe, expect, it } from 'vitest'
import {
    compararComNavegador,
    conferirItens,
    nomeProvisorio,
    situacaoDaLoja,
    taxaDeEntrega,
    type Catalogo,
    type ProdutoCatalogo,
} from './pedido-online-regras'

// Casos reais lidos (só leitura) em 15/10/2026 nos bancos db_giardinetto e db_katatau: produtos, grupos de
// complementos, setores de entrega e horários como estão cadastrados, e pedidos do cardápio que já entraram.

const PONTO_DE_CARNE = {
    id: 'g-ponto', name: 'PONTO DE CARNE', free_quantity: 1,
    options: ['AO PONTO', 'BEM PASSADO', 'MAL PASSADO', 'PONTO MAIS', 'PONTO MENOS'].map((n, i) => ({ id: `o-ponto-${i}`, name: n, price: 0 })),
}
const SABOR_SUCO = {
    id: 'g-suco', name: 'SABOR SUCO/CAIP', free_quantity: 1,
    options: ['ABACAXI', 'FRUTAS VERMELHAS', 'LARANJA', 'LIMÃO', 'MARACUJÁ', 'MORANGO'].map((n, i) => ({ id: `o-suco-${i}`, name: n, price: 5 })),
}

function produto(id: string, name: string, price: number, extra: Partial<ProdutoCatalogo> = {}): ProdutoCatalogo {
    return { id, name, price, category_id: 'cat-1', accepts_fractions: false, grupos: [], ...extra }
}

const GIARDINETTO: ProdutoCatalogo[] = [
    produto('p-rosa', 'ROSA DI PARMA (5 UNID.)', 89),
    produto('p-tagliata', 'TAGLIATA DI MANZO', 129),
    produto('p-porcini', 'RISOTTO PORCINI E BIFE ANCHO', 139, { grupos: [PONTO_DE_CARNE] }),
    produto('p-pera', 'RISOTTO PERA C/ GORGONZOLA E FILE MIGNON', 129, { grupos: [PONTO_DE_CARNE] }),
    produto('p-suco', 'SUCO ', 15, { grupos: [SABOR_SUCO] }),
    produto('p-canelone', 'CANELONE COM MOLHO POMODORO', 89),
    produto('p-caprese', 'RISOTTO CAPRESE C/ BURRATA', 114),
    produto('p-parmegiana', 'ALLA PARMEGIANA', 109),
]

function catalogo(lista: ProdutoCatalogo[]): Catalogo {
    return { porId: new Map(lista.map((p) => [p.id, p])), fracionaveis: lista.filter((p) => p.accepts_fractions) }
}

const SETORES_GIARDINETTO = [
    { id: 's1', fee: 9, name: 'Setor 1', neighborhoods: ['Balneário Copacabana', 'Balneário Delfim Verde', 'Jetuba', 'Portal da Fazendinha', 'Capricórnio I', 'Bairro do Marisco', 'Bosque dos Guarandis', 'Capricórnio III', 'Balneário Parnaso', 'Massaguaçú', 'Balneário Califórnia'] },
    { id: 's2', fee: 14, name: 'Setor 2', neighborhoods: ['Balneário Garden Mar', 'Portal Patrimonium', 'Jardim Camburi', 'Balneário Mar Azul', 'Jardim Balneário do Camburí', 'Balneário Santa Martha', 'Jardim Guaxinduba', 'Jardim Olaria', 'Jardim Flôr do Mar', 'Oceanica', 'Residencial Marverde', 'Costa Verde', 'Jardim Casa Branca', 'Recanto do Sol', 'Casa Branca', 'Martin de Sá'] },
    { id: 's3', fee: 19, name: 'Setor 3', neighborhoods: ['Prainha', 'Cidade Jardim', 'Mocóca', 'Sertão dos Tourinhos', 'Tabatinga', 'Sumaré'] },
    { url: '', _type: 'google_review_config' },
]
const PERFIL_GIARDINETTO = {
    deliveryFee: 50,
    deliverySectors: [...SETORES_GIARDINETTO, { mode: 'STRICT', _type: 'neighborhood_policy' }],
}
const PERFIL_KATATAU = {
    deliveryFee: 10,
    deliverySectors: [
        { id: 'k1', fee: 4, name: 'Setor 1', neighborhoods: ['Varadouro', 'Praia Grande'] },
        { url: '', _type: 'google_review_config' },
        { mode: 'FALLBACK', _type: 'neighborhood_policy' },
    ],
}

describe('taxa de entrega igual à que o cardápio mostra', () => {
    it('Giardinetto: bairro do setor leva a taxa do setor (pedidos 41, 43 e 29)', () => {
        expect(taxaDeEntrega(PERFIL_GIARDINETTO, 'Massaguaçú')).toMatchObject({ taxa: 9, atendido: true })
        expect(taxaDeEntrega(PERFIL_GIARDINETTO, 'Cidade Jardim')).toMatchObject({ taxa: 19, atendido: true })
        expect(taxaDeEntrega(PERFIL_GIARDINETTO, 'Jardim Olaria')).toMatchObject({ taxa: 14, atendido: true })
    })

    it('sem acento e com nome parcial acha o mesmo setor que o cardápio ("Copacabana" -> Balneário Copacabana)', () => {
        expect(taxaDeEntrega(PERFIL_GIARDINETTO, 'massaguacu').taxa).toBe(9)
        expect(taxaDeEntrega(PERFIL_GIARDINETTO, 'Copacabana')).toMatchObject({ taxa: 9, atendido: true })
    })

    it('Giardinetto em STRICT: bairro fora dos setores não é atendido', () => {
        expect(taxaDeEntrega(PERFIL_GIARDINETTO, 'Centro').atendido).toBe(false)
    })

    it('Katatau em FALLBACK: Varadouro paga o setor (pedido 2: R$ 4); bairro fora paga a taxa padrão', () => {
        expect(taxaDeEntrega(PERFIL_KATATAU, 'Varadouro')).toMatchObject({ taxa: 4, atendido: true })
        expect(taxaDeEntrega(PERFIL_KATATAU, 'Centro')).toMatchObject({ taxa: 10, atendido: true })
    })

    it('setores gravados como texto JSON e taxa como texto ("R$ 7,50") também valem', () => {
        const perfil = { deliveryFee: '5', deliverySectors: JSON.stringify([{ fee: 'R$ 7,50', neighborhoods: ['Centro'] }]) }
        expect(taxaDeEntrega(perfil, 'Centro').taxa).toBe(7.5)
        expect(taxaDeEntrega(perfil, 'Outro').taxa).toBe(5)
    })

    it('nome de bairro vazio na lista não casa com qualquer bairro', () => {
        const perfil = { deliveryFee: 10, deliverySectors: [{ fee: 1, neighborhoods: [''] }] }
        expect(taxaDeEntrega(perfil, 'Centro').taxa).toBe(10)
    })
})

describe('preço refeito com o cadastro (06:C6)', () => {
    it('pedido 41 do Giardinetto: 3 pratos, ponto de carne grátis, Massaguaçú -> R$ 366', () => {
        const { itens, problemas } = conferirItens(
            [
                { product_id: 'p-rosa', name: 'ROSA DI PARMA (5 UNID.)', quantity: 1, unit_price: 89 },
                { product_id: 'p-tagliata', name: 'TAGLIATA DI MANZO', quantity: 1, unit_price: 129 },
                { product_id: 'p-porcini', name: 'RISOTTO PORCINI E BIFE ANCHO', quantity: 1, unit_price: 139, complements: [{ name: 'AO PONTO', price: 0, quantity: 1 }] },
            ],
            catalogo(GIARDINETTO),
        )
        expect(problemas).toEqual([])
        const conta = compararComNavegador(itens, 9, { delivery_fee: 9, total_amount: 366 }, true)
        expect(conta).toMatchObject({ subtotal: 357, taxa: 9, total: 366, divergencias: [] })
        expect(itens[2].complementos[0]).toMatchObject({ name: 'AO PONTO', price: 0, quantity: 1, group_id: 'g-ponto' })
    })

    it('pedido 43 do Giardinetto: dois risotos com ponto, Cidade Jardim -> R$ 287', () => {
        const { itens } = conferirItens(
            [
                { product_id: 'p-pera', quantity: 1, unit_price: 129, complements: [{ name: 'PONTO MENOS', price: 0, quantity: 1 }] },
                { product_id: 'p-porcini', quantity: 1, unit_price: 139, complements: [{ name: 'AO PONTO', price: 0, quantity: 1 }] },
            ],
            catalogo(GIARDINETTO),
        )
        expect(compararComNavegador(itens, 19, { delivery_fee: 19, total_amount: 287 }, true).divergencias).toEqual([])
    })

    it('pedido 45 do Giardinetto: suco R$ 15 com 1 sabor de R$ 5 no grupo "1 grátis" fica R$ 15', () => {
        const { itens } = conferirItens(
            [{ product_id: 'p-suco', name: 'SUCO ', quantity: 1, unit_price: 15, complements: [{ name: 'LARANJA', price: 5, quantity: 1 }] }],
            catalogo(GIARDINETTO),
        )
        expect(itens[0].unitarioNuvem).toBe(15)
    })

    it('suco com 2 sabores: o mais barato sai de graça, o outro paga R$ 5 (R$ 20); igual ao cardápio e ao PDV', () => {
        const { itens } = conferirItens(
            [{ product_id: 'p-suco', quantity: 2, unit_price: 20, complements: [
                { option_id: 'o-suco-2', group_id: 'g-suco', name: 'LARANJA', price: 5, quantity: 1 },
                { option_id: 'o-suco-5', group_id: 'g-suco', name: 'MORANGO', price: 5, quantity: 1 },
            ] }],
            catalogo(GIARDINETTO),
        )
        expect(itens[0].unitarioNuvem).toBe(20)
        expect(compararComNavegador(itens, 0, { delivery_fee: 0, total_amount: 40 }, false).total).toBe(40)
    })

    it('pedido 2 da Katatau: marmita R$ 28 + Varadouro R$ 4 = R$ 32', () => {
        const { itens } = conferirItens(
            [{ product_id: 'k-acebolado', quantity: 1, unit_price: 28 }],
            catalogo([produto('k-acebolado', 'BIFE ACEBOLADO MARMITA P', 28)]),
        )
        expect(compararComNavegador(itens, taxaDeEntrega(PERFIL_KATATAU, 'Varadouro').taxa, { delivery_fee: 4, total_amount: 32 }, true).divergencias).toEqual([])
    })

    it('prato de R$ 109 mandado a R$ 1 pelo navegador é divergência (o ataque do achado)', () => {
        const { itens } = conferirItens([{ product_id: 'p-parmegiana', quantity: 1, unit_price: 1 }], catalogo(GIARDINETTO))
        const conta = compararComNavegador(itens, 14, { delivery_fee: 14, total_amount: 15 }, true)
        expect(conta.total).toBe(123)
        expect(conta.divergencias.length).toBe(2) // o item e o total
    })

    it('item certo mas total mexido, ou taxa mexida, também é divergência', () => {
        const { itens } = conferirItens([{ product_id: 'p-caprese', quantity: 1, unit_price: 114 }], catalogo(GIARDINETTO))
        expect(compararComNavegador(itens, 14, { delivery_fee: 14, total_amount: 100 }, true).divergencias).toHaveLength(1)
        expect(compararComNavegador(itens, 14, { delivery_fee: 0, total_amount: 114 }, true).divergencias).toHaveLength(2)
    })

    it('diferença de 1 centavo (arredondamento) não é divergência', () => {
        const { itens } = conferirItens([{ product_id: 'x', quantity: 3, unit_price: 3.33 }], catalogo([produto('x', 'Pão', 3.333)]))
        expect(compararComNavegador(itens, 0, { delivery_fee: 0, total_amount: 9.99 }, false).divergencias).toEqual([])
    })

    it('pizza meio a meio cobra o sabor mais caro (pelo id novo ou pelo nome do cardápio antigo)', () => {
        const pizzas = [
            produto('pz-cal', 'Pizza Calabresa', 50, { accepts_fractions: true, category_id: 'pizzas' }),
            produto('pz-por', 'Pizza Portuguesa', 62, { accepts_fractions: true, category_id: 'pizzas' }),
        ]
        const novo = conferirItens(
            [{ product_id: 'pz-cal', quantity: 1, unit_price: 62, fractions: [{ flavor_id: 'pz-cal', name: 'Pizza Calabresa' }, { flavor_id: 'pz-por', name: 'Pizza Portuguesa' }] }],
            catalogo(pizzas),
        )
        expect(novo.itens[0].unitarioNuvem).toBe(62)
        expect(novo.itens[0].sabores).toEqual(['Pizza Calabresa', 'Pizza Portuguesa'])
        const antigo = conferirItens(
            [{ product_id: 'pz-cal', quantity: 1, unit_price: 62, fractions: [{ product_id: 'pz-cal', name: 'Pizza Calabresa' }, { product_id: 'pz-cal', name: 'pizza portuguesa' }] }],
            catalogo(pizzas),
        )
        expect(antigo.itens[0].unitarioNuvem).toBe(62)
    })

    it('sabor que não existe mais vira problema (o cliente atualiza a página)', () => {
        const pizzas = [produto('pz-cal', 'Pizza Calabresa', 50, { accepts_fractions: true })]
        const r = conferirItens([{ product_id: 'pz-cal', quantity: 1, unit_price: 50, fractions: [{ name: 'Pizza Calabresa' }, { name: 'Pizza Sumida' }] }], catalogo(pizzas))
        expect(r.problemas[0].tipo).toBe('sabor_desconhecido')
    })

    it('meia porção do cardápio do Marujo = 65% do preço', () => {
        const { itens } = conferirItens([{ product_id: 'm1', quantity: 1, unit_price: 58.5, meia_porcao: true }], catalogo([produto('m1', 'Moqueca', 90)]))
        expect(itens[0].unitarioNuvem).toBe(58.5)
    })

    it('produto que não existe, complemento de outro produto e quantidade negativa viram problema', () => {
        const cat = catalogo(GIARDINETTO)
        expect(conferirItens([{ product_id: 'nao-existe', quantity: 1, unit_price: 10 }], cat).problemas[0].tipo).toBe('item_desconhecido')
        expect(conferirItens([{ product_id: 'p-caprese', quantity: 1, unit_price: 114, complements: [{ name: 'LARANJA', price: 0 }] }], cat).problemas[0].tipo).toBe('complemento_desconhecido')
        expect(conferirItens([{ product_id: 'p-caprese', quantity: -2, unit_price: 114 }], cat).problemas[0].tipo).toBe('quantidade_invalida')
    })
})

// Horários reais: Giardinetto ter. 12:00-16:00 e 18:00-21:30, seg. fechado; Marujo seg. 18:00-23:30, ter. fechado,
// sex. 18:00-00:00; Katatau dom. 06:00-15:00. Datas: 12/10/2026 = segunda, 13/10 = terça, 16/10 = sexta.
// Hora de Brasília = UTC - 3.
const brt = (iso: string) => new Date(new Date(iso + 'Z').getTime() + 3 * 3600_000)

const GIARDINETTO_HORAS = {
    isOpenManual: true,
    businessHours: [
        { dayOfWeek: 1, openTime: '00:00', closeTime: '23:00', isOpen: false },
        { dayOfWeek: 2, openTime: '12:00', closeTime: '16:00', isOpen: true },
        { dayOfWeek: 2, openTime: '18:00', closeTime: '21:30', isOpen: true },
    ],
}
const MARUJO_HORAS = {
    isOpenManual: true,
    businessHours: [
        { dayOfWeek: 1, openTime: '18:00', closeTime: '23:30', isOpen: true },
        { dayOfWeek: 2, openTime: '18:00', closeTime: '23:30', isOpen: false },
        { dayOfWeek: 5, openTime: '18:00', closeTime: '00:00', isOpen: true },
        { dayOfWeek: 6, openTime: '18:00', closeTime: '00:00', isOpen: true },
    ],
}

describe('loja aberta conferida na nuvem (06:C4)', () => {
    it('Giardinetto terça 19:00 aberto; 17:00 fechado com o horário de abrir', () => {
        expect(situacaoDaLoja(GIARDINETTO_HORAS, brt('2026-10-13T19:00:00')).aberta).toBe(true)
        const r = situacaoDaLoja(GIARDINETTO_HORAS, brt('2026-10-13T17:00:00'))
        expect(r.aberta).toBe(false)
        expect(r.motivo).toContain('18:00')
    })

    it('15 min de folga depois de fechar (quem estava no meio do pedido); depois disso recusa', () => {
        expect(situacaoDaLoja(GIARDINETTO_HORAS, brt('2026-10-13T21:44:00')).aberta).toBe(true)
        expect(situacaoDaLoja(GIARDINETTO_HORAS, brt('2026-10-13T21:46:00')).aberta).toBe(false)
    })

    it('segunda do Giardinetto (dia desligado) e madrugada recusam', () => {
        expect(situacaoDaLoja(GIARDINETTO_HORAS, brt('2026-10-12T20:00:00')).aberta).toBe(false)
        expect(situacaoDaLoja(GIARDINETTO_HORAS, brt('2026-10-13T03:00:00')).aberta).toBe(false)
    })

    it('Marujo sexta 18:00-00:00: 23:59 aberto e 00:10 de sábado ainda aceita (turno de sexta)', () => {
        expect(situacaoDaLoja(MARUJO_HORAS, brt('2026-10-16T23:59:00')).aberta).toBe(true)
        expect(situacaoDaLoja(MARUJO_HORAS, brt('2026-10-17T00:10:00')).aberta).toBe(true)
        expect(situacaoDaLoja(MARUJO_HORAS, brt('2026-10-17T00:30:00')).aberta).toBe(false)
    })

    it('turno que vira a madrugada vale no dia seguinte mesmo com o dia seguinte fechado', () => {
        const perfil = { isOpenManual: true, businessHours: [{ dayOfWeek: 5, openTime: '18:00', closeTime: '02:00', isOpen: true }] }
        expect(situacaoDaLoja(perfil, brt('2026-10-17T01:30:00')).aberta).toBe(true)
        expect(situacaoDaLoja(perfil, brt('2026-10-17T03:00:00')).aberta).toBe(false)
    })

    it('Marujo terça desligada: recusa às 20:00', () => {
        expect(situacaoDaLoja(MARUJO_HORAS, brt('2026-10-13T20:00:00')).aberta).toBe(false)
    })

    it('pausa manual recusa sempre; loja sem perfil aceita (como o cardápio)', () => {
        expect(situacaoDaLoja({ ...GIARDINETTO_HORAS, isOpenManual: false }, brt('2026-10-13T19:00:00')).aberta).toBe(false)
        expect(situacaoDaLoja(null, brt('2026-10-13T03:00:00')).aberta).toBe(true)
    })

    it('Katatau domingo 06:00-15:00', () => {
        const perfil = { isOpenManual: true, businessHours: [{ dayOfWeek: 0, openTime: '06:00', closeTime: '15:00', isOpen: true }] }
        expect(situacaoDaLoja(perfil, brt('2026-10-18T12:00:00')).aberta).toBe(true)
        expect(situacaoDaLoja(perfil, brt('2026-10-18T05:00:00')).aberta).toBe(false)
    })
})

describe('nome provisório do cadastro (06:C5)', () => {
    it('"Cliente Delivery", vazio e número de telefone são provisórios; nome de gente não', () => {
        expect(nomeProvisorio('Cliente Delivery')).toBe(true)
        expect(nomeProvisorio('')).toBe(true)
        expect(nomeProvisorio('(12) 99999-0000')).toBe(true)
        expect(nomeProvisorio('Maria')).toBe(false)
    })
})
