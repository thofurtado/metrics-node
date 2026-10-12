import { describe, expect, it } from 'vitest'
import { codigoCurtoDoProduto, eanDoItemIfood, valoresDoItemIfood } from './ifood-itens'

// Formato conferido no diário real do iFood (ifood_api_logs do db_restaurante, 184 itens, 12/10/2026)
describe('itens do pedido do iFood (12/10/2026)', () => {
  it('"Código PDV" só com número curto vira o código do produto (o mesmo do caixa)', () => {
    expect(codigoCurtoDoProduto('175')).toBe(175)
    expect(codigoCurtoDoProduto(' 900385 ')).toBe(900385)
  })

  it('código de barras de 13 dígitos, texto ou zero não viram código curto', () => {
    expect(codigoCurtoDoProduto('7891000100103')).toBeNull()
    expect(codigoCurtoDoProduto('ABC-1')).toBeNull()
    expect(codigoCurtoDoProduto('0')).toBeNull()
    expect(codigoCurtoDoProduto(undefined)).toBeNull()
  })

  it('pega o código de barras que o iFood manda no item', () => {
    expect(eanDoItemIfood({ ean: '7891000100103' })).toBe('7891000100103')
    expect(eanDoItemIfood({ ean: '' })).toBeNull()
    expect(eanDoItemIfood({})).toBeNull()
  })

  it('preço unitário já com os adicionais: unitPrice 5, adicionais e totalPrice 16 (pedido real)', () => {
    expect(valoresDoItemIfood({ quantity: 1, unitPrice: 5, optionsPrice: 8, price: 5, totalPrice: 16 })).toEqual({ quantidade: 1, unitario: 16, total: 16 })
    expect(valoresDoItemIfood({ quantity: 2, unitPrice: 10, totalPrice: 27 })).toEqual({ quantidade: 2, unitario: 13.5, total: 27 })
  })

  it('sem totalPrice usa o unitário; sem preço nenhum fica zero (antes inventava R$ 25,00)', () => {
    expect(valoresDoItemIfood({ quantity: 3, unitPrice: 4 })).toEqual({ quantidade: 3, unitario: 4, total: 12 })
    expect(valoresDoItemIfood({})).toEqual({ quantidade: 1, unitario: 0, total: 0 })
  })
})
