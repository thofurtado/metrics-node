// Gravação da batida do Ponto (Mergulho, ligação 01). O banco é simulado: este teste não conecta em nada.
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/prisma', () => ({ prisma: {} }))

const { RegisterTimeClockUseCase, RecusaDaBatida } = await import('./register-time-clock')
const { getCompetenceDate } = await import('../../../utils/get-competence-date')
const { tirarPinDoEndereco } = await import('../../../utils/tirar-pin-do-endereco')

type Dia = Record<string, any>

function montar(funcionario: { id: string; name: string; isRegistered: boolean } | null, dias: Dia[] = []) {
  const funcionarios = { findByPin: vi.fn(async () => funcionario) }
  const batidas = {
    findByEmployeeAndDate: vi.fn(async (_id: string, date: Date) => dias.find((d) => d.date.getTime() === date.getTime()) ?? null),
    create: vi.fn(async (data: any) => {
      const dia = { id: `t${dias.length + 1}`, ...data }
      dias.push(dia)
      return dia
    }),
    update: vi.fn(async (id: string, data: any) => {
      const dia = dias.find((d) => d.id === id)!
      Object.assign(dia, data)
      return dia
    }),
  }
  const caso = new RegisterTimeClockUseCase(funcionarios as any, batidas as any)
  return { caso, batidas, dias }
}

const ANA = { id: 'e1', name: 'Ana', isRegistered: true }

describe('Ponto: funcionário inativo (01:R1)', () => {
  it('a gravação com internet recusa o inativo e não grava nada', async () => {
    const { caso, batidas } = montar({ ...ANA, isRegistered: false })
    const erro = await caso.execute({ pin: '1234', action: 'clockIn' }).catch((e) => e)
    expect(erro).toBeInstanceOf(RecusaDaBatida)
    expect(erro.codigo).toBe('EMPLOYEE_INACTIVE')
    expect(batidas.create).not.toHaveBeenCalled()
    expect(batidas.update).not.toHaveBeenCalled()
  })

  it('a fila também recusa o inativo', async () => {
    const { caso, batidas } = montar({ ...ANA, isRegistered: false })
    const erro = await caso
      .execute({ pin: '1234', action: 'clockIn', timestamp: '2026-10-15T11:00:00.000Z', isOffline: true })
      .catch((e) => e)
    expect(erro.codigo).toBe('EMPLOYEE_INACTIVE')
    expect(batidas.create).not.toHaveBeenCalled()
  })

  it('PIN que não existe continua "não encontrado"', async () => {
    const { caso } = montar(null)
    const erro = await caso.execute({ pin: '0000', action: 'clockIn' }).catch((e) => e)
    expect(erro.message).toBe('Employee not found')
    expect(erro.codigo).toBe('EMPLOYEE_NOT_FOUND')
  })
})

describe('Ponto: casa já preenchida (01:R4) e recusas com motivo (01:R8)', () => {
  // Sexta, 16/10/2026: entrada às 18:00 de Brasília (21:00 UTC)
  const sexta = getCompetenceDate(new Date('2026-10-16T21:00:00.000Z'))

  it('na fila, a Entrada da 01:30 de sábado cai na sexta, que já tem 18:00: vai para as recusadas com o motivo', async () => {
    const { caso, dias } = montar(ANA, [{ id: 't1', date: sexta, clockIn: new Date('2026-10-16T21:00:00.000Z') }])
    const erro = await caso
      .execute({ pin: '1234', action: 'clockIn', timestamp: '2026-10-17T04:30:00.000Z', isOffline: true })
      .catch((e) => e)
    expect(erro).toBeInstanceOf(RecusaDaBatida)
    expect(erro.codigo).toBe('ALREADY_RECORDED')
    expect(erro.mensagem).toContain('18:00')
    expect(erro.mensagem).toContain('01:30')
    // a hora que estava continua valendo
    expect(dias[0].clockIn.toISOString()).toBe('2026-10-16T21:00:00.000Z')
  })

  it('na fila, o reenvio da MESMA batida (hora poucos segundos diferente) continua sendo sucesso', async () => {
    const { caso, batidas } = montar(ANA, [{ id: 't1', date: sexta, clockIn: new Date('2026-10-16T21:00:00.000Z') }])
    const r = await caso.execute({ pin: '1234', action: 'clockIn', timestamp: '2026-10-16T21:00:09.000Z', isOffline: true })
    expect(r.timestamp.toISOString()).toBe('2026-10-16T21:00:00.000Z')
    expect(batidas.update).not.toHaveBeenCalled()
  })

  it('com internet, casa já preenchida vira recusa com a hora que já estava (era 500 genérico)', async () => {
    const hoje = getCompetenceDate(new Date())
    const { caso } = montar(ANA, [{ id: 't1', date: hoje, clockIn: new Date(Date.now() - 3 * 60 * 60 * 1000) }])
    const erro = await caso.execute({ pin: '1234', action: 'clockIn' }).catch((e) => e)
    expect(erro.codigo).toBe('ALREADY_RECORDED')
    expect(erro.mensagem).toMatch(/Entrada já registrada hoje às \d\d:\d\d/)
  })

  it('com internet, fora da ordem vira recusa com o motivo', async () => {
    const hoje = getCompetenceDate(new Date())
    const { caso } = montar(ANA, [{ id: 't1', date: hoje, clockIn: new Date(Date.now() - 60 * 60 * 1000) }])
    const erro = await caso.execute({ pin: '1234', action: 'breakEnd' }).catch((e) => e)
    expect(erro.codigo).toBe('OUT_OF_ORDER')
    expect(erro.message).toBe('Must start break before ending it')
  })

  it('sem a Entrada do dia, a recusa diz isso (com internet e na fila)', async () => {
    const { caso } = montar(ANA)
    const erro = await caso
      .execute({ pin: '1234', action: 'clockOut', timestamp: '2026-10-16T21:00:00.000Z', isOffline: true })
      .catch((e) => e)
    expect(erro.codigo).toBe('OUT_OF_ORDER')
    expect(erro.message).toBe('Must clock in first')
  })

  it('hora inválida na fila é recusa definitiva (não erro do banco)', async () => {
    const { caso } = montar(ANA)
    const erro = await caso.execute({ pin: '1234', action: 'clockIn', timestamp: 'ontem', isOffline: true }).catch((e) => e)
    expect(erro.codigo).toBe('INVALID_TIMESTAMP')
  })
})

describe('Ponto: fila fora da ordem (01:R7)', () => {
  it('a batida entra (não se perde hora real), mas volta um aviso', async () => {
    const sexta = getCompetenceDate(new Date('2026-10-16T21:00:00.000Z'))
    const { caso, dias } = montar(ANA, [{ id: 't1', date: sexta, clockIn: new Date('2026-10-16T21:00:00.000Z') }])
    const r: any = await caso.execute({ pin: '1234', action: 'extraClockOut', timestamp: '2026-10-17T04:30:00.000Z', isOffline: true })
    expect(dias[0].extraClockOut.toISOString()).toBe('2026-10-17T04:30:00.000Z')
    expect(r.aviso).toContain('fora da ordem')
  })

  it('batida na ordem certa não traz aviso', async () => {
    const sexta = getCompetenceDate(new Date('2026-10-16T21:00:00.000Z'))
    const { caso } = montar(ANA, [{ id: 't1', date: sexta, clockIn: new Date('2026-10-16T21:00:00.000Z') }])
    const r: any = await caso.execute({ pin: '1234', action: 'clockOut', timestamp: '2026-10-17T04:30:00.000Z', isOffline: true })
    expect(r.aviso).toBeUndefined()
  })
})

describe('Registro do servidor sem o PIN (01:R11)', () => {
  it('troca o PIN do endereço por ****', () => {
    expect(tirarPinDoEndereco('/hr/time-clock/status?pin=1234')).toBe('/hr/time-clock/status?pin=****')
    expect(tirarPinDoEndereco('/x?a=1&pin=9876&b=2')).toBe('/x?a=1&pin=****&b=2')
    expect(tirarPinDoEndereco('/hr/employees/sync')).toBe('/hr/employees/sync')
    // "spin=" não é o PIN
    expect(tirarPinDoEndereco('/x?spin=12')).toBe('/x?spin=12')
  })
})
