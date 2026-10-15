// Rotas do Ponto (Mergulho, ligação 01): o que a nuvem responde para a fila e para a gravação com internet.
// O banco é simulado: este teste não conecta em nada.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado: { funcionario: any; dias: any[]; falharBanco: boolean } = { funcionario: null, dias: [], falharBanco: false }

vi.mock('../../repositories/prisma/prisma-employees-repository', () => ({
  PrismaEmployeesRepository: class {
    async findByPin() {
      return estado.funcionario
    }
  },
}))
vi.mock('../../repositories/prisma/prisma-time-clocks-repository', () => ({
  PrismaTimeClocksRepository: class {
    async findByEmployeeAndDate(_id: string, date: Date) {
      if (estado.falharBanco) throw Object.assign(new Error("Can't reach database server"), { code: 'P1001' })
      return estado.dias.find((d) => d.date.getTime() === date.getTime()) ?? null
    }
    async create(data: any) {
      const dia = { id: `t${estado.dias.length + 1}`, ...data }
      estado.dias.push(dia)
      return dia
    }
    async update(id: string, data: any) {
      const dia = estado.dias.find((d) => d.id === id)
      Object.assign(dia, data)
      return dia
    }
  },
}))

const { syncOffline, register } = await import('./time-clock')

function resposta() {
  const r: any = { codigo: 0, corpo: null }
  r.status = (c: number) => {
    r.codigo = c
    return r
  }
  r.send = (b: any) => {
    r.corpo = b
    return r
  }
  return r
}

beforeEach(() => {
  estado.funcionario = { id: 'e1', name: 'Ana', isRegistered: true }
  estado.dias = []
  estado.falharBanco = false
})

describe('fila do Ponto (01:R3)', () => {
  it('devolve o número de cada batida e separa a que entrou da recusada', async () => {
    const r = resposta()
    await syncOffline(
      {
        body: {
          punches: [
            { id: 7, pin: '1234', action: 'clockIn', timestamp: '2026-10-16T21:00:00.000Z' },
            { id: 8, pin: '1234', action: 'clockIn', timestamp: '2026-10-17T04:30:00.000Z' },
          ],
        },
      } as any,
      r
    )
    expect(r.codigo).toBe(200)
    expect(r.corpo.results.map((x: any) => x.id)).toEqual([7])
    expect(r.corpo.errors).toHaveLength(1)
    expect(r.corpo.errors[0]).toMatchObject({ id: 8, code: 'ALREADY_RECORDED', permanente: true })
    expect(r.corpo.errors[0].mensagem).toContain('não entrou')
  })

  it('o Ponto antigo (sem número na batida) continua aceito', async () => {
    const r = resposta()
    await syncOffline({ body: { punches: [{ pin: '1234', action: 'clockIn', timestamp: '2026-10-16T21:00:00.000Z' }] } } as any, r)
    expect(r.codigo).toBe(200)
    expect(r.corpo.syncedCount).toBe(1)
    expect(r.corpo.results[0].id).toBeUndefined()
  })

  it('banco fora = 503, para o Ponto (antigo e novo) guardar tudo e tentar de novo', async () => {
    estado.falharBanco = true
    const r = resposta()
    await syncOffline({ body: { punches: [{ id: 1, pin: '1234', action: 'clockIn', timestamp: '2026-10-16T21:00:00.000Z' }] } } as any, r)
    expect(r.codigo).toBe(503)
    expect(r.corpo.errors[0]).toMatchObject({ id: 1, permanente: false, code: 'TRANSIENT_ERROR' })
  })

  it('inativo na fila vai para as recusadas definitivas (01:R1)', async () => {
    estado.funcionario = { id: 'e1', name: 'Ana', isRegistered: false }
    const r = resposta()
    await syncOffline({ body: { punches: [{ id: 3, pin: '1234', action: 'clockIn', timestamp: '2026-10-16T21:00:00.000Z' }] } } as any, r)
    expect(r.codigo).toBe(200)
    expect(r.corpo.errors[0]).toMatchObject({ id: 3, code: 'EMPLOYEE_INACTIVE', permanente: true })
  })
})

describe('gravação com internet (01:R1, 01:R8)', () => {
  it('inativo = 401 com o código, como na consulta do PIN', async () => {
    estado.funcionario = { id: 'e1', name: 'Ana', isRegistered: false }
    const r = resposta()
    await register({ body: { pin: '1234', action: 'clockIn' } } as any, r)
    expect(r.codigo).toBe(401)
    expect(r.corpo.code).toBe('EMPLOYEE_INACTIVE')
  })

  it('fora da ordem = 409 com o motivo (era 500 genérico)', async () => {
    const r = resposta()
    await register({ body: { pin: '1234', action: 'breakEnd' } } as any, r)
    expect(r.codigo).toBe(409)
    expect(r.corpo.code).toBe('OUT_OF_ORDER')
  })

  it('banco fora continua 503', async () => {
    estado.falharBanco = true
    const r = resposta()
    await register({ body: { pin: '1234', action: 'clockIn' } } as any, r)
    expect(r.codigo).toBe(503)
  })
})
