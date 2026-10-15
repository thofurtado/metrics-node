import { beforeEach, describe, expect, it, vi } from 'vitest'

const entregue = vi.fn(async () => ({ ok: true, errno: 0 }))
const pronto = vi.fn(async () => ({ ok: true, errno: 0 }))
vi.mock('./food99-api.service', () => ({
  food99Api: {
    deliveredOrder: (...a: any[]) => entregue(...(a as [])),
    confirmOrder: vi.fn(async () => ({ ok: true })),
    readyOrder: (...a: any[]) => pronto(...(a as [])),
    cancelOrder: vi.fn(async () => ({ ok: true })),
  },
}))
vi.mock('./ifood-poller', () => ({ getValidAccessToken: vi.fn(async () => '') }))
vi.mock('./ifood-events.service', () => ({ writeJournal: vi.fn() }))
vi.mock('./ifood-api.service', () => ({ ifoodApi: {} }))
vi.mock('@/env', () => ({ env: {} }))

import { entregaPropriaDa99, handleDeliveryOrderStatusChange } from './delivery-order-lifecycle.service'

// Observação real que o webhook grava (Katatau, 13/10/2026)
const obsPropria = '[99Food] Pedido #5764615930446094492 | Pagamento via 99Food | Nº 5 | Entrega própria | [99Loja:5764615930446088131]'
const obsDa99 = '[99Food] Pedido #5764615930446094492 | Pagamento via 99Food | Entrega 99Food | [99Loja:5764615930446088131]'

describe('99: entrega da própria loja concluída no PDV avisa a 99 (Mergulho 10:N1)', () => {
  beforeEach(() => entregue.mockClear())

  it('reconhece a entrega própria pela observação', () => {
    expect(entregaPropriaDa99(obsPropria)).toBe(true)
    expect(entregaPropriaDa99(obsDa99)).toBe(false)
    expect(entregaPropriaDa99('[99Food] Pedido #1 | Pagamento via 99Food | Retirada')).toBe(false)
    expect(entregaPropriaDa99(null)).toBe(false)
  })

  it('entregue no PDV: chama o "delivered" da 99 com a loja e o pedido', async () => {
    const ok = await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'SaiuEntrega' }, 'delivered')
    expect(ok).toBe(true)
    expect(entregue).toHaveBeenCalledWith('5764615930446088131', '5764615930446094492')
  })

  it('não chama quando a 99 já concluiu, nem na entrega feita pela 99', async () => {
    await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'Entregue' }, 'delivered')
    await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsDa99, status_delivery: 'SaiuEntrega' }, 'delivered')
    await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'EmPreparo' }, 'dispatched')
    expect(entregue).not.toHaveBeenCalled()
  })
})

describe('99: na entrega da loja o "pronto" vai à 99 só no despacho (15/10/2026)', () => {
  beforeEach(() => { entregue.mockClear(); pronto.mockClear() })
  const loja = '5764615930446088131', pedido99 = '5764615930446094492'

  it('Conferência da entrega da loja não avisa a 99 (senão o cliente vê "a caminho" antes da saída)', async () => {
    const ok = await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'EmPreparo' }, 'conferencia')
    expect(ok).toBe(true)
    expect(pronto).not.toHaveBeenCalled()
  })

  it('despacho da entrega da loja manda o "pronto"; recusa da 99 (já pronto) não vira erro para o caixa', async () => {
    expect(await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'Conferencia' }, 'dispatched')).toBe(true)
    expect(pronto).toHaveBeenCalledWith(loja, pedido99)
    pronto.mockResolvedValueOnce({ ok: false, errno: 1 } as any)
    expect(await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'Conferencia' }, 'dispatched')).toBe(true)
  })

  it('entrega do entregador da 99 e retirada continuam avisando na Conferência e não no despacho', async () => {
    await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsDa99, status_delivery: 'EmPreparo' }, 'conferencia')
    expect(pronto).toHaveBeenCalledTimes(1)
    await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsDa99, status_delivery: 'Conferencia' }, 'dispatched')
    expect(pronto).toHaveBeenCalledTimes(1)
  })

  it('baixa direto da Conferência (sem Na rua): manda o "pronto" antes do "entregue"; depois do despacho, só o "entregue"', async () => {
    await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'Conferencia' }, 'delivered')
    expect(pronto).toHaveBeenCalledTimes(1)
    expect(entregue).toHaveBeenCalledTimes(1)
    pronto.mockClear(); entregue.mockClear()
    await handleDeliveryOrderStatusChange({ id: 1, uuid: 'u', display_id: 5, observacao: obsPropria, status_delivery: 'SaiuEntrega' }, 'delivered')
    expect(pronto).not.toHaveBeenCalled()
    expect(entregue).toHaveBeenCalledTimes(1)
  })
})
