import { describe, expect, it } from 'vitest'
import { montarPedidosOnline } from './pedido-online-dto'

// Banco de mentira: só o que montarPedidosOnline lê
function bancoFalso() {
  return {
    client: { findMany: async () => [{ id: 'cli-1', name: 'Cliente Teste', phone: '11999990000' }] },
    address: {
      findMany: async () => [
        { id: 'end-pedido', street: 'Rua do Pedido', number: '10', neighborhood: 'Vila Nova', city: 'Santos', zipcode: '11000000' },
      ],
    },
    product: { findMany: async () => [{ id: 'prod-1', name: 'Pizza Grande' }] },
  } as any
}

function pedido(extra: Record<string, unknown> = {}) {
  return {
    uuid: 'ped-1', display_id: 1, origem: 'Delivery', status: 'Aberto', status_delivery: 'Pendente',
    cliente_id: 'cli-1', endereco_entrega_id: 'end-pedido', cpf_na_nota: null,
    valor_final: 95.8, valor_frete: 10, valor_troco: null, entregador: null, hora_saida_rota: null,
    observacao: '', caixa_id: null, data_abertura: new Date('2026-10-09T21:10:59Z'),
    itens: [{ id: 1, uuid: 'it-1', produto_id: 'prod-1', quantidade: 1, valor_unitario: 85.8, observacao: null, complementos_json: null }],
    ...extra,
  } as any
}

describe('pedido online igual na lista de pendentes e no aviso ao vivo (09/10/2026)', () => {
  it('entrega leva bairro, cidade, CEP, taxa e o endereço do próprio pedido', async () => {
    const [dto] = await montarPedidosOnline(bancoFalso(), [pedido()])
    expect(dto.neighborhood).toBe('Vila Nova')
    expect(dto.city).toBe('Santos')
    expect(dto.zipcode).toBe('11000000')
    expect(dto.delivery_fee).toBe(10)
    expect(dto.address).toBe('Rua do Pedido, 10 - Vila Nova, Santos')
    expect(dto.is_takeout).toBe(false)
    expect(dto.status).toBe('pending')
  })

  it('o item vai com o nome do produto, não com a observação', async () => {
    const [dto] = await montarPedidosOnline(bancoFalso(), [pedido()])
    expect(dto.items[0].name).toBe('Pizza Grande')
    expect(dto.items[0].product_id).toBe('prod-1')
  })

  it('pedido sem endereço de entrega é retirada no balcão', async () => {
    const [dto] = await montarPedidosOnline(bancoFalso(), [pedido({ endereco_entrega_id: null, valor_frete: 0 })])
    expect(dto.is_takeout).toBe(true)
    expect(dto.neighborhood).toBe('Balcão')
    expect(dto.address).toBe('Retirada no Balcão')
    expect(dto.delivery_fee).toBe(0)
  })
})

describe('pedido do iFood no PDV (12/10/2026)', () => {
  it('complemento vai no endereço e o ponto de referência com "retirada" não vira retirada', async () => {
    const banco = bancoFalso()
    banco.address.findMany = async () => [
      { id: 'end-pedido', street: 'Rua do Pedido', number: '10', neighborhood: 'Vila Nova', city: 'Santos', zipcode: null, complement: 'Apto 3' },
    ]
    const [dto] = await montarPedidosOnline(banco, [pedido({
      observacao: '[iFood:x] Pedido #1 | Pagamento via iFood | Referência: em frente à retirada de lixo',
    })])
    expect(dto.is_takeout).toBe(false)
    expect(dto.address).toBe('Rua do Pedido, 10 Apto 3 - Vila Nova, Santos')
  })

  it('item do iFood ainda sem vínculo vai com o nome que veio do iFood', async () => {
    const [dto] = await montarPedidosOnline(bancoFalso(), [pedido({
      itens: [{ id: 2, uuid: 'it-2', produto_id: null, external_name: 'Marmita P', quantidade: 1, valor_unitario: 20, observacao: 'Marmita P', complementos_json: null }],
    })])
    expect(dto.items[0].name).toBe('Marmita P')
  })
})
