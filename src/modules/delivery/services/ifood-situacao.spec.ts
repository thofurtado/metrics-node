import { describe, expect, it } from 'vitest'
import { avancaSituacao, situacaoDoEvento, situacaoFinalPorPedido } from './ifood-situacao'

// Lote real ao autorizar a Katatau (12/10/2026): PLC, CFM, DDCR, DSP, CON, CAN, HSD, HSS dos pedidos do dia inteiro
describe('situação real do pedido do iFood pelos eventos (12/10/2026)', () => {
  it('cada evento indica a etapa; os informativos não mudam nada', () => {
    expect(situacaoDoEvento({ code: 'CFM' })?.status_delivery).toBe('EmPreparo')
    expect(situacaoDoEvento({ fullCode: 'READY_TO_PICKUP' })?.status_delivery).toBe('Conferencia')
    expect(situacaoDoEvento({ code: 'DSP' })?.status_delivery).toBe('SaiuEntrega')
    expect(situacaoDoEvento({ code: 'CON' })).toEqual({ status: 'Fechado', status_delivery: 'Entregue' })
    for (const code of ['PLC', 'DDCR', 'DDCS', 'HSS', 'HSD', 'CAR', 'CAN']) expect(situacaoDoEvento({ code })).toBeNull()
  })

  it('no lote, vale a etapa mais adiantada de cada pedido, em qualquer ordem', () => {
    const final = situacaoFinalPorPedido([
      { code: 'PLC', orderId: 'a' }, { code: 'CON', orderId: 'a' }, { code: 'CFM', orderId: 'a' }, { code: 'DSP', orderId: 'a' },
      { code: 'PLC', orderId: 'b' }, { code: 'CFM', orderId: 'b' }, { code: 'DDCR', orderId: 'b' },
      { code: 'PLC', orderId: 'c' },
    ])
    expect(final.get('a')?.status_delivery).toBe('Entregue')
    expect(final.get('b')?.status_delivery).toBe('EmPreparo')
    expect(final.has('c')).toBe(false) // pedido novo de verdade: nasce Pendente e dispara o alerta
  })

  it('a situação só anda para a frente (aceito pelo PDV e depois o CFM do iFood não volta nada)', () => {
    expect(avancaSituacao('Pendente', situacaoDoEvento({ code: 'CFM' }))).toBe(true)
    expect(avancaSituacao('SaiuEntrega', situacaoDoEvento({ code: 'CFM' }))).toBe(false)
    expect(avancaSituacao('EmPreparo', situacaoDoEvento({ code: 'CFM' }))).toBe(false)
    expect(avancaSituacao('EmRota', situacaoDoEvento({ code: 'DSP' }))).toBe(false)
    expect(avancaSituacao('Conferencia', situacaoDoEvento({ code: 'CON' }))).toBe(true)
    expect(avancaSituacao('Pendente', null)).toBe(false)
  })
})
