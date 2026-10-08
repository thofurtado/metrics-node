import { describe, it, expect } from 'vitest'
import { diaDoPonto } from './time-clocks-admin'

// Caso do Marujo (08/10/2026): com o servidor no horário de Brasília, a busca do dia 02 pegava a linha do dia 03 e o dia 02 nunca
// era criado. O dia da batida tem de ser a meia-noite UTC daquela data, qualquer que seja o fuso do servidor.
describe('Espelho de ponto: o dia da batida', () => {
  it('é a meia-noite UTC do dia, sem depender do fuso do servidor', () => {
    expect(diaDoPonto('2026-10-02').toISOString()).toBe('2026-10-02T00:00:00.000Z')
    expect(diaDoPonto('2026-10-31').toISOString()).toBe('2026-10-31T00:00:00.000Z')
    // A tela às vezes manda a data com hora: vale só o dia
    expect(diaDoPonto('2026-10-02T03:00:00.000Z').toISOString()).toBe('2026-10-02T00:00:00.000Z')
  })

  it('dias vizinhos nunca se confundem', () => {
    expect(diaDoPonto('2026-10-02').getTime()).not.toBe(diaDoPonto('2026-10-03').getTime())
  })
})
