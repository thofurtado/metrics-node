import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SEGREDO = 'segredo-de-teste'
const diario: any[] = []
const resolver = vi.fn()

vi.mock('@/env', () => ({ env: { FOOD99_SECRET: 'segredo-de-teste' } }))
vi.mock('@/lib/sse-manager', () => ({ sseManager: { notifyTenant: vi.fn() } }))
vi.mock('../../services/ifood-events.service', () => ({ writeJournal: (e: any) => { diario.push(e) } }))
vi.mock('../../services/delivery-tenant-resolver', () => ({ resolveTenantForMerchant: (...a: any[]) => resolver(...a) }))

import { webhook99FoodController } from './webhook-99food'

function chamar(corpo: any, assinatura: 'certa' | 'errada' | 'nenhuma' = 'certa') {
  const raw = JSON.stringify(corpo)
  const sign = assinatura === 'certa' ? crypto.createHash('md5').update(raw + SEGREDO, 'utf-8').digest('hex') : assinatura === 'errada' ? 'x' : ''
  const request: any = { body: corpo, rawBody: raw, headers: sign ? { 'didi-header-sign': sign } : {} }
  const resposta: any = {}
  const reply: any = {
    status: (c: number) => { resposta.status = c; return reply },
    send: (b: any) => { resposta.body = b; return reply },
  }
  return webhook99FoodController(request, reply).then(() => resposta)
}

describe('webhook da 99: loja e assinatura (Mergulho 10:N4 e 10:N2)', () => {
  beforeEach(() => {
    diario.length = 0
    resolver.mockReset()
    resolver.mockRejectedValue(new Error('loja desconhecida'))
  })
  afterEach(() => { delete process.env.FOOD99_RECUSAR_ASSINATURA_INVALIDA })

  it('aviso da loja sem ID (shopBindStatus, como no diário real) só fica no diário: errno 0 e nenhum banco aberto', async () => {
    const r = await chamar({ app_id: '1', type: 'shopBindStatus', timestamp: 1, data: { bindStatus: 'bind', appShopIDList: ['577'] } })
    expect(r.body).toEqual({ errno: 0, errmsg: 'ok' })
    expect(resolver).not.toHaveBeenCalled()
  })

  it('pedido novo sem o ID da loja NÃO vai para o banco de teste: erro no diário e errno 1 (a 99 reenvia)', async () => {
    const r = await chamar({ app_id: '1', type: 'orderNew', timestamp: 1, data: { order_id: '99', order_info: { order_id: '99' } } })
    expect(r.body.errno).toBe(1)
    expect(resolver).not.toHaveBeenCalled()
    expect(diario.some((e) => e.endpoint === 'orderNew:erro' && e.success === false)).toBe(true)
  })

  it('assinatura errada com a trava LIGADA: recusa o aviso de pedido sem abrir o banco', async () => {
    process.env.FOOD99_RECUSAR_ASSINATURA_INVALIDA = '1'
    const r = await chamar({ app_id: '1', app_shop_id: '555', type: 'orderFinish', timestamp: 1, data: { order_id: '99' } }, 'errada')
    expect(r.body).toEqual({ errno: 1, errmsg: 'invalid signature' })
    expect(resolver).not.toHaveBeenCalled()
    expect(diario.some((e) => e.endpoint === 'orderFinish:recusado')).toBe(true)
  })

  it('trava DESLIGADA (padrão): assinatura errada segue só registrada, como antes', async () => {
    await chamar({ app_id: '1', app_shop_id: '555', type: 'orderFinish', timestamp: 1, data: { order_id: '99' } }, 'errada')
    expect(resolver).toHaveBeenCalledWith('555', 'FOOD99')
    expect(diario[0].request.signature).toBe('invalida')
  })

  it('trava ligada e assinatura certa: segue para a loja', async () => {
    process.env.FOOD99_RECUSAR_ASSINATURA_INVALIDA = '1'
    await chamar({ app_id: '1', app_shop_id: '555', type: 'orderFinish', timestamp: 1, data: { order_id: '99' } }, 'certa')
    expect(resolver).toHaveBeenCalledWith('555', 'FOOD99')
  })
})

describe('webhook da 99: resultado do envio do cardápio (Mergulho 10:N6)', () => {
  beforeEach(() => { diario.length = 0; resolver.mockReset() })

  it('grava no diário se a 99 aceitou, com a loja, sem mexer em pedido', async () => {
    const r = await chamar({ app_id: '1', app_shop_id: '576', type: 'uploadMenuTaskStatus', timestamp: 1, data: { status: 1, taskID: 7, message: 'success', operationList: [] } })
    expect(r.body).toEqual({ errno: 0, errmsg: 'ok' })
    const aplicado = diario.find((e) => e.endpoint === 'uploadMenuTaskStatus/aplicado')
    expect(aplicado.success).toBe(true)
    expect(aplicado.request).toMatchObject({ app_shop_id: '576', taskId: '7', ok: true })
    expect(resolver).not.toHaveBeenCalled()
  })
})
