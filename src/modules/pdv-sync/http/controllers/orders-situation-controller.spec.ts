import { describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
vi.mock('@fastify/request-context', () => ({ requestContext: { get: (k: string) => (k === 'prisma' ? { pedido: { findMany } } : undefined) } }))

import { getOrdersSituation } from './orders-situation-controller'

function resposta() {
  const r: any = { code: 0, body: null }
  r.status = (c: number) => { r.code = c; return r }
  r.send = (b: any) => { r.body = b; return r }
  return r
}

describe('situação de pedidos antigos para o PDV', () => {
  it('o iFood #5706 entregue na nuvem volta como delivered', async () => {
    findMany.mockResolvedValueOnce([{ uuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7', status: 'Fechado', status_delivery: 'Entregue' }])
    const r = resposta()
    await getOrdersSituation({ query: { uuids: '7c9e6679-7425-40de-944b-e07fc1f90ae7' } } as any, r)
    expect(r.code).toBe(200)
    expect(r.body.orders).toEqual([{ id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', status: 'delivered', status_delivery: 'Entregue' }])
  })

  it('ignora código inválido, repetido e passa de 50 só os 50 primeiros', async () => {
    findMany.mockResolvedValueOnce([])
    const validos = Array.from({ length: 60 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    await getOrdersSituation({ query: { uuids: ['lixo', validos[0], ...validos].join(',') } } as any, resposta())
    const pedidos = findMany.mock.calls.at(-1)![0].where.uuid.in
    expect(pedidos).toHaveLength(50)
    expect(pedidos).not.toContain('lixo')
  })

  it('sem nenhum código válido não consulta o banco', async () => {
    findMany.mockClear()
    const r = resposta()
    await getOrdersSituation({ query: { uuids: 'abc,def' } } as any, r)
    expect(r.body).toEqual({ orders: [] })
    expect(findMany).not.toHaveBeenCalled()
  })
})
