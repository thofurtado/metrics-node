import { describe, expect, it } from 'vitest'
import { colunaObservacaoRapidaAusente, precoDaOpcao, semObservacaoRapida } from './observacao-rapida'

describe('Observação rápida (só no salão): regras', () => {
    it('opção de grupo marcado tem preço zero; grupo comum, o preço cadastrado', () => {
        expect(precoDaOpcao(true, 3.5)).toBe(0)
        expect(precoDaOpcao(false, 3.5)).toBe(3.5)
        expect(precoDaOpcao(undefined, 2)).toBe(2)
        expect(precoDaOpcao(null, null)).toBe(0)
    })

    it('tira só os grupos marcados', () => {
        const grupos = [{ id: 'a', quick_note: false }, { id: 'b', quick_note: true }, { id: 'c' }]
        expect(semObservacaoRapida(grupos).map((g) => g.id)).toEqual(['a', 'c'])
    })

    it('reconhece o erro de coluna ausente só quando é a quick_note', () => {
        expect(colunaObservacaoRapidaAusente({ code: 'P2022', meta: { column: 'complement_groups.quick_note' } })).toBe(true)
        expect(colunaObservacaoRapidaAusente(new Error('column complement_groups.quick_note does not exist'))).toBe(true)
        expect(colunaObservacaoRapidaAusente({ code: 'P2022', meta: { column: 'products.cest' } })).toBe(false)
        expect(colunaObservacaoRapidaAusente(new Error('timeout'))).toBe(false)
        expect(colunaObservacaoRapidaAusente(null)).toBe(false)
    })
})
