import { describe, expect, it } from 'vitest'
import {
  eventoDeCancelado,
  FilaDePedidosNovos,
  MAX_TENTATIVAS_PEDIDO_NOVO,
  pedidosQueFalharam,
  situacaoMaisAdiantada,
} from './ifood-fila-pedidos'

const plc = (orderId: string, extra: Record<string, unknown> = {}) => ({ id: `ev-${orderId}`, code: 'PLC', orderId, merchantId: 'loja-1', ...extra })

describe('fila de nova tentativa dos pedidos novos do iFood (Mergulho 09:F3)', () => {
  it('cada loja só pega os pedidos dela (antes a rodada da loja seguinte pegava o pedido da outra)', () => {
    const fila = new FilaDePedidosNovos()
    fila.falhou('db_katatau', plc('a'))
    fila.falhou('db_giardinetto', plc('b'))
    expect(fila.retirar('db_giardinetto').map((e) => e.orderId)).toEqual(['b'])
    expect(fila.retirar('db_katatau').map((e) => e.orderId)).toEqual(['a'])
    expect(fila.retirar('db_marujo')).toEqual([])
  })

  it('a nova tentativa vem marcada (não recebe ACK de novo) e sem a marca antiga', () => {
    const fila = new FilaDePedidosNovos()
    fila.falhou('db_katatau', { ...plc('a'), __retry: true })
    const [evento] = fila.retirar('db_katatau')
    expect(evento.__retry).toBe(true)
    expect(evento.orderId).toBe('a')
  })

  it('desiste depois do limite e NÃO recomeça a contagem (antes voltava zerada e tentava para sempre)', () => {
    const fila = new FilaDePedidosNovos()
    expect(fila.falhou('db_katatau', plc('a'))).toBe(true)
    for (let i = 1; i < MAX_TENTATIVAS_PEDIDO_NOVO; i++) {
      expect(fila.retirar('db_katatau')).toHaveLength(1)
      expect(fila.falhou('db_katatau', plc('a'))).toBe(true)
    }
    expect(fila.retirar('db_katatau')).toHaveLength(1)
    expect(fila.falhou('db_katatau', plc('a'))).toBe(false)
    expect(fila.retirar('db_katatau')).toEqual([])
    expect(fila.tamanho).toBe(0)
  })

  it('pedido gravado sai da fila', () => {
    const fila = new FilaDePedidosNovos()
    fila.falhou('db_katatau', plc('a'))
    fila.resolvido('db_katatau', 'a')
    expect(fila.retirar('db_katatau')).toEqual([])
  })
})

describe('pedidos que falharam, relidos no diário ao reiniciar (09:F3)', () => {
  const linha = (orderId: string, success: boolean, response: Record<string, unknown> = {}, request: any = plc(orderId)) => ({
    order_id: orderId,
    success,
    request_body: request,
    response_body: { source: 'polling', ...response },
  })

  it('só volta o pedido cuja ÚLTIMA tentativa falhou, com a loja gravada no diário', () => {
    const r = pedidosQueFalharam([
      linha('a', false, { tenant: 'db_katatau' }),
      linha('a', true, { tenant: 'db_katatau' }),
      linha('b', true, { tenant: 'db_katatau' }),
      linha('b', false, { tenant: 'db_katatau' }),
      linha('c', false, {}),
    ])
    expect(r.map((x) => [x.event.orderId, x.dbName])).toEqual([
      ['b', 'db_katatau'],
      ['c', null],
    ])
  })

  it('linha de duplicado não esconde a falha; linha sem o evento é ignorada', () => {
    const r = pedidosQueFalharam([
      linha('a', false, { tenant: 'db_katatau' }),
      linha('a', true, { duplicate: true, tenant: 'db_katatau' }),
      linha('d', false, { tenant: 'db_katatau' }, null),
    ])
    expect(r.map((x) => x.event.orderId)).toEqual(['a'])
  })

  it('tira a marca de nova tentativa do evento guardado', () => {
    const [r] = pedidosQueFalharam([linha('a', false, { tenant: 'db_katatau' }, { ...plc('a'), __retry: true })])
    expect(r.event.__retry).toBeUndefined()
  })
})

describe('situação do pedido que entra numa nova tentativa', () => {
  it('cancelado no iFood é só o CAN (pedir para cancelar não é cancelar)', () => {
    expect(eventoDeCancelado({ code: 'CAN' })).toBe(true)
    expect(eventoDeCancelado({ fullCode: 'CANCELLED' })).toBe(true)
    expect(eventoDeCancelado({ code: 'CAR' })).toBe(false)
    expect(eventoDeCancelado({ code: 'CARF' })).toBe(false)
  })

  it('vale a mais adiantada entre o lote e o diário', () => {
    const aceito = { status: 'Aberto', status_delivery: 'EmPreparo' } as const
    const saiu = { status: 'Aberto', status_delivery: 'SaiuEntrega' } as const
    expect(situacaoMaisAdiantada(aceito, saiu)).toBe(saiu)
    expect(situacaoMaisAdiantada(saiu, aceito)).toBe(saiu)
    expect(situacaoMaisAdiantada(null, aceito)).toBe(aceito)
    expect(situacaoMaisAdiantada(null, null)).toBeNull()
  })
})
