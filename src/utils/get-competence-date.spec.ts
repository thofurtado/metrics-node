import { describe, expect, it } from 'vitest'
import { getCompetenceDate } from './get-competence-date'

// Horários de Brasília escritos com o fuso, para o teste não depender do fuso do computador nem do servidor.
const brt = (iso: string) => new Date(`${iso}-03:00`)
const dia = (d: Date) => d.toISOString()

describe('dia de competência do Ponto (vira às 04:00 de Brasília)', () => {
  it('a entrada das 06:23 é do próprio dia (caso do vídeo de 29/09/2026)', () => {
    expect(dia(getCompetenceDate(brt('2026-09-29T06:23:00')))).toBe('2026-09-29T00:00:00.000Z')
  })

  it('a partir das 04:00 é o dia novo', () => {
    expect(dia(getCompetenceDate(brt('2026-09-29T04:00:00')))).toBe('2026-09-29T00:00:00.000Z')
    expect(dia(getCompetenceDate(brt('2026-09-29T23:59:00')))).toBe('2026-09-29T00:00:00.000Z')
  })

  it('saída de madrugada, antes das 04:00, fecha o dia anterior', () => {
    expect(dia(getCompetenceDate(brt('2026-09-30T00:30:00')))).toBe('2026-09-29T00:00:00.000Z')
    expect(dia(getCompetenceDate(brt('2026-09-30T03:59:59')))).toBe('2026-09-29T00:00:00.000Z')
  })

  it('21:00 de Brasília (meia-noite UTC) NÃO vira o dia', () => {
    expect(dia(getCompetenceDate(brt('2026-09-29T21:30:00')))).toBe('2026-09-29T00:00:00.000Z')
  })

  it('virada de mês e de ano', () => {
    expect(dia(getCompetenceDate(brt('2026-10-01T02:00:00')))).toBe('2026-09-30T00:00:00.000Z')
    expect(dia(getCompetenceDate(brt('2027-01-01T03:00:00')))).toBe('2026-12-31T00:00:00.000Z')
  })
})
