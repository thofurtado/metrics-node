import { describe, expect, it } from 'vitest'
import { chaveDoItem99, normalizarNome, sugerirProduto } from './food99-vinculos'

// Nomes como estão no cardápio da Katatau na 99 (12/10/2026) e produtos parecidos com os do PDV dela.
const produtos = [
  { id: 'p1', name: 'COCA COLA LATA 350ML', display_id: 1 },
  { id: 'p2', name: 'COCA COLA 2L', display_id: 2 },
  { id: 'p3', name: 'X-SALADA', display_id: 3 },
  { id: 'p4', name: 'X-BACON', display_id: 4 },
  { id: 'p5', name: 'GUARANA ANTARTICA LATA 350ML', display_id: 5 },
  { id: 'p6', name: 'X-TUDO', display_id: 6 },
  { id: 'p7', name: 'DUO PRESUNTO+QUEIJO', display_id: 7 },
  { id: 'p8', name: 'OMELETE SABORES PF', display_id: 8 },
  { id: 'p9', name: 'PORÇÃO DE ISCA DE CARNE 300G', display_id: 9 },
  { id: 'p10', name: 'PORÇÃO DE ISCAS DE FRANGO 300G', display_id: 10 },
  { id: 'p11', name: 'PAO NA CHAPA', display_id: 11 },
  { id: 'p13', name: 'COCA COLA 600ML', display_id: 13 },
  { id: 'p14', name: 'ESPONJA NAO RISCA', display_id: 14 },
  { id: 'p15', name: 'X-CALABRESA', display_id: 15 },
]

describe('normalizarNome', () => {
  it('tira acento, pontuação e junta a unidade ao número', () => {
    expect(normalizarNome('Coca - Cola Lata 350 Ml')).toBe('coca cola lata 350ml')
    expect(normalizarNome('Guaraná Antárctica 2 Litros')).toBe('guarana antarctica 2l')
    expect(normalizarNome('X-Burguer c/ Ovo')).toBe('x burguer com ovo')
    expect(normalizarNome(null)).toBe('')
  })
})

describe('chaveDoItem99', () => {
  it('usa o app_item_id quando existe', () => {
    expect(chaveDoItem99('abc-123', 'Coca')).toBe('abc-123')
  })
  it('sem app_item_id usa o nome normalizado, igual no cardápio e no pedido', () => {
    expect(chaveDoItem99('', 'Coca - Cola Lata 350 Ml')).toBe('nome:coca cola lata 350ml')
    expect(chaveDoItem99(undefined, 'COCA-COLA LATA 350ml')).toBe(chaveDoItem99('', 'Coca - Cola Lata 350 Ml'))
  })
  it('sem id e sem nome não inventa código', () => {
    expect(chaveDoItem99('', '  ')).toBe('')
  })
})

describe('sugerirProduto', () => {
  it('acha a lata certa e não o 2 litros', () => {
    expect(sugerirProduto('Coca - Cola Lata 350 Ml', produtos)?.id).toBe('p1')
  })
  it('prato com o nome entre parênteses usa o que está dentro', () => {
    expect(sugerirProduto('Hoje Pode ( X Salada ) - Top 3 Mais !', produtos)?.id).toBe('p3')
  })
  it('sinônimo de grafia (Antárctica x Antartica)', () => {
    expect(sugerirProduto('Guaraná Antárctica Lata 350ml', produtos)?.id).toBe('p5')
  })
  it('não sugere quando nada é parecido', () => {
    expect(sugerirProduto('Açaí 500ml com Granola', produtos)).toBeNull()
  })
  it('plural e o nome genérico "porção" não atrapalham, e frango não vira carne', () => {
    expect(sugerirProduto('Isca de Frango - 300 G', produtos)?.id).toBe('p10')
    expect(sugerirProduto('Isca de Carne - 300 G', produtos)?.id).toBe('p9')
  })
  it('palavra decisiva tem de bater: "sem chapa" e "zero" não viram o produto comum', () => {
    expect(sugerirProduto('Pão sem Chapa - Unid.', produtos)).toBeNull()
    expect(sugerirProduto('Pão na Chapa - Unid.', produtos)?.id).toBe('p11')
    expect(sugerirProduto('Guarana Antarctica 350ml Zero', produtos)).toBeNull()
  })
  it('tamanho diferente é outro produto', () => {
    expect(sugerirProduto('Coca Cola 2 Lt', produtos.filter((p) => p.id === 'p13'))).toBeNull()
  })
  it('omelete com recheio entre parênteses não vira o recheio', () => {
    expect(sugerirProduto('Omelete ( Presunto & Queijo )', produtos)).toBeNull()
  })
  it('lanche entre parênteses vale mesmo com nome de fora que existe em outro produto', () => {
    expect(sugerirProduto('Não Conta Pra Nutri ( X Calabresa )', produtos)?.id).toBe('p15')
  })
  it('não sugere quando dois produtos empatam', () => {
    expect(sugerirProduto('Coca Cola', produtos)).toBeNull()
  })
})
