import { describe, expect, it } from 'vitest'
import { documentoDoCliente, observacaoDoPedidoIfood, resumoDoPagamento } from './ifood-nota'

// Formato conferido no diário real do iFood (ifood_api_logs, 29/09/2026)
describe('pedido do iFood para a nota do delivery', () => {
  it('pega o CPF ou o CNPJ que o cliente informou para a nota', () => {
    expect(documentoDoCliente({ documentType: 'CPF', documentNumber: '529.982.247-25' })).toBe('52998224725')
    expect(documentoDoCliente({ documentType: 'cnpj', documentNumber: '14380200000121' })).toBe('14380200000121')
  })

  it('sem documento ou com outro tipo, a nota sai sem CPF', () => {
    expect(documentoDoCliente({ name: 'Cliente' })).toBeNull()
    expect(documentoDoCliente({ documentType: 'idEstrangeiro', documentNumber: '12.345' })).toBeNull()
    expect(documentoDoCliente({ documentType: 'CPF', documentNumber: '123' })).toBeNull()
  })

  it('pago no app: "Pagamento via iFood" com a forma', () => {
    const order = { merchant: { id: 'loja-123' }, payments: { methods: [{ method: 'CREDIT', type: 'ONLINE', prepaid: true }] } }
    expect(observacaoDoPedidoIfood('abc', 4672, order)).toBe('[iFood:abc] Pedido #4672 | Pagamento via iFood (Crédito) | [iFoodLoja:loja-123]')
  })

  it('pago na entrega: "Pagar na entrega" com o troco, para o motoboy cobrar', () => {
    const payments = { methods: [{ method: 'CASH', type: 'OFFLINE', prepaid: false, cash: { changeFor: 100 } }] }
    expect(resumoDoPagamento(payments)).toEqual({ naEntrega: true, texto: 'Dinheiro (troco para R$ 100,00)' })
    expect(observacaoDoPedidoIfood('abc', 1, { payments })).toBe('[iFood:abc] Pedido #1 | Pagar na entrega: Dinheiro (troco para R$ 100,00)')
  })

  it('sem forma no pedido, fica como antes', () => {
    expect(observacaoDoPedidoIfood('abc', 1, {})).toBe('[iFood:abc] Pedido #1 | Pagamento via iFood')
  })
})
