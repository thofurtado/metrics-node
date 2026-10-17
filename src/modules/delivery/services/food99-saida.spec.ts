import { describe, expect, it } from 'vitest'
import { corpoDaSaida99, telefoneDaLojaPara99 } from './food99-saida'

describe('99: corpo do "saiu para entrega" da entrega da loja (17/10/2026)', () => {
  const saidaEm = new Date('2026-10-17T19:57:00Z')
  const chegadaPrevista = new Date('2026-10-17T20:27:00Z')

  it('motoboy, telefone da loja com +55, moto e horários em segundos (10 dígitos)', () => {
    expect(corpoDaSaida99({ nomeDoEntregador: '  Jefferson   da Silva ', telefone: '12988887777', saidaEm, chegadaPrevista })).toEqual({
      courier_info: {
        courier_name: 'Jefferson da Silva',
        courier_first_name: 'Jefferson',
        courier_last_name: 'da Silva',
        courier_phone_code: '+55',
        courier_phone: '12988887777',
      },
      vehicle: { vehicle_type: 102 },
      limit_time: { pickup_time: 1792267020, delivery_time: 1792268820 },
    })
  })

  it('sem nome ou com um nome só, nada obrigatório fica vazio', () => {
    const semNome = corpoDaSaida99({ nomeDoEntregador: null, telefone: '1238881234', saidaEm, chegadaPrevista }) as any
    expect(semNome.courier_info.courier_name).toBe('Entregador da loja')
    expect(semNome.courier_info.courier_first_name).toBe('Entregador')
    expect(semNome.courier_info.courier_last_name).toBe('da loja')
    const umNome = corpoDaSaida99({ nomeDoEntregador: 'Henrique', telefone: '1238881234', saidaEm, chegadaPrevista }) as any
    expect(umNome.courier_info.courier_first_name).toBe('Henrique')
    expect(umNome.courier_info.courier_last_name).toBe('Entregador')
  })

  it('telefone da loja: só dígitos, sem o 55 e com DDD; curto ou vazio = sem telefone', () => {
    expect(telefoneDaLojaPara99('+55 (12) 98888-7777')).toBe('12988887777')
    expect(telefoneDaLojaPara99('5512988887777')).toBe('12988887777')
    expect(telefoneDaLojaPara99('(12) 3888-1234')).toBe('1238881234')
    expect(telefoneDaLojaPara99('012 98888-7777')).toBe('12988887777')
    expect(telefoneDaLojaPara99('98888-7777')).toBeNull()
    expect(telefoneDaLojaPara99('')).toBeNull()
    expect(telefoneDaLojaPara99(null)).toBeNull()
  })
})
