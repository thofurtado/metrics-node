import { describe, it, expect } from 'vitest'
import { JuizDaTroca } from './cluster-judge'

describe('juiz da troca automática de servidor', () => {
    it('conta o tempo sem ouvir cada computador pelo relógio da nuvem', () => {
        let agora = 1_000_000
        const juiz = new JuizDaTroca(() => agora, 0)
        juiz.avisarVivo('loja.metrics.dev.br', { terminalId: 'term-a', nome: 'CAIXA-1', situacao: 'Servidor', mandato: 1 })
        agora += 200_000
        const r = juiz.avisarVivo('loja.metrics.dev.br', { terminalId: 'TERM-B', nome: 'CAIXA-2', situacao: 'Reserva', mandato: 1 })
        const a = r.computadores.find((c) => c.terminalId === 'TERM-A')!
        const b = r.computadores.find((c) => c.terminalId === 'TERM-B')!
        expect(a.segundosDesdeUltimo).toBe(200)
        expect(b.segundosDesdeUltimo).toBe(0)
        expect(r.segundosDesdeInicio).toBe(1200)
    })

    it('o maior mandato vem só de quem se diz servidor', () => {
        const juiz = new JuizDaTroca(() => 5000, 0)
        juiz.avisarVivo('loja', { terminalId: 'A', situacao: 'Servidor', mandato: 2 })
        const r = juiz.avisarVivo('loja', { terminalId: 'B', situacao: 'Reserva', mandato: 9 })
        expect(r.mandatoMaximo).toBe(2)
    })

    it('lojas nunca se misturam', () => {
        const juiz = new JuizDaTroca(() => 5000, 0)
        juiz.avisarVivo('loja-a', { terminalId: 'A', situacao: 'Servidor', mandato: 3 })
        const r = juiz.avisarVivo('LOJA-B', { terminalId: 'B', situacao: 'Servidor', mandato: 1 })
        expect(r.computadores.map((c) => c.terminalId)).toEqual(['B'])
        expect(r.mandatoMaximo).toBe(1)
    })

    it('esquece computador que não aparece há mais de um dia', () => {
        let agora = 0
        const juiz = new JuizDaTroca(() => agora, 0)
        juiz.avisarVivo('loja', { terminalId: 'VELHO', situacao: 'Reserva' })
        agora += 25 * 60 * 60 * 1000
        const r = juiz.avisarVivo('loja', { terminalId: 'NOVO', situacao: 'Servidor', mandato: 1 })
        expect(r.computadores.map((c) => c.terminalId)).toEqual(['NOVO'])
    })
})
