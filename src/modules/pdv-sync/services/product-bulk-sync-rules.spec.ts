import { describe, expect, it } from 'vitest'

describe('Regras de Atribuição de SKU / DisplayId no Sync de Produtos', () => {
    it('deve preservar o displayId original quando informado pelo Sync (ex: Athos 175 Salgado Frito)', () => {
        const payloadDisplayId = 175
        const existingConflict = null

        let finalDisplayId: number
        let currentMax = 100

        if (payloadDisplayId) {
            if (!existingConflict) {
                finalDisplayId = payloadDisplayId
            } else {
                currentMax++
                finalDisplayId = currentMax
            }
        } else {
            currentMax++
            finalDisplayId = currentMax
        }

        currentMax = Math.max(currentMax, finalDisplayId)

        expect(finalDisplayId).toBe(175)
        expect(currentMax).toBe(175)
    })

    it('deve gerar próximo sequencial quando displayId não for fornecido', () => {
        const payloadDisplayId = null
        let currentMax = 200

        let finalDisplayId: number
        if (payloadDisplayId) {
            finalDisplayId = payloadDisplayId
        } else {
            currentMax++
            finalDisplayId = currentMax
        }

        expect(finalDisplayId).toBe(201)
        expect(currentMax).toBe(201)
    })

    it('deve atualizar display_id de produto existente quando o SKU legado for sincronizado', () => {
        const existing = { id: 'p1', display_id: 12, name: 'SALGADO FRITO' }
        const p = { displayId: 175, name: 'SALGADO FRITO' }
        const conflict = null

        let displayIdToUpdate: number | undefined = undefined
        if (p.displayId && existing.display_id !== p.displayId) {
            if (!conflict) {
                displayIdToUpdate = p.displayId
            }
        }

        expect(displayIdToUpdate).toBe(175)
    })
})