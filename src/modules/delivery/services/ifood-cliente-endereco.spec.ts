import { describe, expect, it } from 'vitest'
import { contatoDoClienteIfood, enderecoDaEntregaIfood, mesmoEndereco, observacaoDoPedidoIfood } from './ifood-nota'

// Formato conferido no diário real do iFood (ifood_api_logs do db_restaurante, 92 pedidos, 12/10/2026): o telefone é um 0800
// compartilhado (o mesmo em até 12 pedidos de clientes diferentes) com um localizador de 8 dígitos que muda a cada pedido,
// e o bairro vem em deliveryAddress.neighborhood
describe('cliente e endereço do pedido do iFood (12/10/2026)', () => {
  it('0800 compartilhado vira 0800 + localizador, único por pedido e dentro dos 20 caracteres do PDV', () => {
    const a = contatoDoClienteIfood({ phone: { number: '0800 705 0500', localizer: '12345678' } })
    const b = contatoDoClienteIfood({ phone: { number: '0800 705 0500', localizer: '87654321' } })
    expect(a.telefone).toBe('08007050500 12345678')
    expect(a.telefone!.length).toBeLessThanOrEqual(20)
    expect(b.telefone).not.toBe(a.telefone)
    expect(a.texto).toBe('Ligar 0800 705 0500, localizador 1234 5678')
  })

  it('0800 sem localizador nunca serve para reaproveitar cliente', () => {
    expect(contatoDoClienteIfood({ phone: { number: '0800 705 0500' } })).toEqual({ telefone: null, texto: 'Ligar 0800 705 0500' })
  })

  it('sem telefone fica sem telefone (antes caía num 11999999999 fixo, igual para todos)', () => {
    expect(contatoDoClienteIfood({ name: 'Cliente' })).toEqual({ telefone: null, texto: null })
    expect(contatoDoClienteIfood(undefined)).toEqual({ telefone: null, texto: null })
  })

  it('telefone de verdade continua sendo o telefone', () => {
    expect(contatoDoClienteIfood({ phone: { number: '(12) 99111-2233' } }).telefone).toBe('12991112233')
  })

  it('endereço sai do próprio pedido, com o bairro de neighborhood e o complemento', () => {
    const e = enderecoDaEntregaIfood({
      streetName: 'Rua das Flores', streetNumber: '120', neighborhood: 'Varadouro', city: 'São Sebastião', state: 'SP',
      postalCode: '11600000', complement: 'Apto 12', reference: 'Perto da padaria',
    })
    expect(e).toEqual({
      street: 'Rua das Flores', number: '120', neighborhood: 'Varadouro', city: 'São Sebastião', state: 'SP',
      zipcode: '11600000', complement: 'Apto 12',
    })
  })

  it('sem bairro não inventa "Centro"; sem cidade não inventa "Caraguatatuba"; retirada não tem endereço', () => {
    const e = enderecoDaEntregaIfood({ streetName: 'Rua A' })!
    expect(e.neighborhood).toBe('Bairro não informado')
    expect(e.city).toBe('')
    expect(e.number).toBe('S/N')
    expect(enderecoDaEntregaIfood(undefined)).toBeNull()
    expect(enderecoDaEntregaIfood({})).toBeNull()
  })

  it('mesmo endereço é reaproveitado; outro número ou complemento vira endereço novo', () => {
    const e = enderecoDaEntregaIfood({ streetName: 'Rua A', streetNumber: '10', neighborhood: 'B', complement: 'Casa 2' })!
    expect(mesmoEndereco({ street: 'rua a', number: '10', complement: 'casa 2' }, e)).toBe(true)
    expect(mesmoEndereco({ street: 'Rua A', number: '11', complement: 'Casa 2' }, e)).toBe(false)
    expect(mesmoEndereco({ street: 'Rua A', number: '10', complement: null }, e)).toBe(false)
  })

  it('a observação leva o contato e o ponto de referência, sem a barra que separa as partes no PDV', () => {
    const order = {
      payments: { methods: [{ method: 'CREDIT', type: 'ONLINE', prepaid: true }] },
      customer: { phone: { number: '0800 705 0500', localizer: '12345678' } },
      delivery: { deliveryAddress: { reference: 'Portão azul | ao lado do mercado' } },
    }
    expect(observacaoDoPedidoIfood('abc', 7, order)).toBe(
      '[iFood:abc] Pedido #7 | Pagamento via iFood (Crédito) | Ligar 0800 705 0500, localizador 1234 5678 | Referência: Portão azul / ao lado do mercado',
    )
  })
})
