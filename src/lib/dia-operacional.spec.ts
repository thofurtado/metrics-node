import { describe, expect, it } from 'vitest'
import { diaOperacional, inicioDoDiaOperacional, intervaloDoDiaOperacional, mesmoDiaOperacional } from './dia-operacional'

// Horários de Brasília escritos com o fuso, para o teste não depender do fuso do computador.
const brt = (iso: string) => new Date(`${iso}-03:00`)

describe('dia operacional (vira às 05:00 de Brasília)', () => {
  it('madrugada conta para o dia anterior', () => {
    expect(diaOperacional(brt('2026-09-25T01:00:00'))).toBe('2026-09-24')
    expect(diaOperacional(brt('2026-09-25T04:59:59'))).toBe('2026-09-24')
  })

  it('a partir das 05:00 é o dia novo', () => {
    expect(diaOperacional(brt('2026-09-25T05:00:00'))).toBe('2026-09-25')
    expect(diaOperacional(brt('2026-09-25T23:59:00'))).toBe('2026-09-25')
  })

  it('21:00 de Brasília (meia-noite UTC) NÃO vira o dia', () => {
    expect(diaOperacional(brt('2026-09-25T21:30:00'))).toBe('2026-09-25')
  })

  it('início do dia é 05:00 de Brasília (08:00 UTC)', () => {
    expect(inicioDoDiaOperacional('2026-09-25').toISOString()).toBe('2026-09-25T08:00:00.000Z')
  })

  it('intervalo vai das 05:00 até as 05:00 do dia seguinte', () => {
    const { dia, inicio, fim } = intervaloDoDiaOperacional(brt('2026-09-26T02:00:00'))
    expect(dia).toBe('2026-09-25')
    expect(inicio.toISOString()).toBe('2026-09-25T08:00:00.000Z')
    expect(fim.toISOString()).toBe('2026-09-26T08:00:00.000Z')
  })

  it('caixa das 18:00 e venda da 01:00 seguinte são do mesmo dia', () => {
    expect(mesmoDiaOperacional(brt('2026-09-24T18:00:00'), brt('2026-09-25T01:00:00'))).toBe(true)
    expect(mesmoDiaOperacional(brt('2026-09-24T18:00:00'), brt('2026-09-25T06:00:00'))).toBe(false)
  })
})

describe('data do dia operacional (coluna só data)', () => {
  it('caixa aberto às 22:00 de Brasília fica no próprio dia', async () => {
    const { dataDoDiaOperacional } = await import('./dia-operacional')
    expect(dataDoDiaOperacional(brt('2026-09-25T22:00:00')).toISOString()).toBe('2026-09-25T00:00:00.000Z')
    expect(dataDoDiaOperacional(brt('2026-09-26T02:00:00')).toISOString()).toBe('2026-09-25T00:00:00.000Z')
  })
})
