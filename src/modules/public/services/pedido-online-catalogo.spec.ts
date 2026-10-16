import { describe, expect, it } from 'vitest'
import { carregarCatalogoDoPedido } from './pedido-online-catalogo'
import { conferirItens, type ItemEnviado } from './pedido-online-regras'

// 06:C6 + observação rápida (só no salão), 16/10/2026: a conferência do pedido do cardápio não conhece o grupo marcado.
const GRUPOS = {
    adicionais: { id: 'g-adic', name: 'Adicionais', free_quantity: 0, quick_note: false, options: [{ id: 'o-bacon', name: 'Bacon', price: 4 }] },
    salao: { id: 'g-salao', name: 'Sem cebola', free_quantity: 0, quick_note: true, options: [{ id: 'o-sem-cebola', name: 'Sem cebola', price: 0 }] },
}

function bancoFalso(semColuna = false) {
    const chamadas: any[] = []
    const banco: any = {
        product: {
            findMany: async ({ select }: any) => {
                chamadas.push(select)
                const filtro = select.complementGroups.where?.group
                if (semColuna && filtro?.quick_note !== undefined) {
                    throw Object.assign(new Error('The column `complement_groups.quick_note` does not exist in the current database.'), { code: 'P2022' })
                }
                const grupos = [GRUPOS.adicionais, GRUPOS.salao].filter((g) => filtro?.quick_note === undefined || g.quick_note === filtro.quick_note)
                return [{ id: 'p-pizza', name: 'Pizza', price: 50, category_id: 'c1', subcategory: null, complementGroups: grupos.map((group, order) => ({ order, group })) }]
            },
        },
    }
    return { banco, chamadas }
}

const item = (complements: any[], unit_price: number): ItemEnviado => ({ product_id: 'p-pizza', name: 'Pizza', quantity: 1, unit_price, complements })

describe('Conferência do pedido do cardápio (06:C6): observação rápida', () => {
    it('o catálogo do pedido só traz os grupos do cliente', async () => {
        const { banco, chamadas } = bancoFalso()
        const catalogo = await carregarCatalogoDoPedido(banco, [item([], 50)])
        expect(chamadas[0].complementGroups.where).toEqual({ group: { quick_note: false } })
        expect(catalogo.porId.get('p-pizza')!.grupos.map((g) => g.id)).toEqual(['g-adic'])
    })

    it('opção de grupo de observação rápida no pedido do cardápio é recusada (complemento não encontrado)', async () => {
        const { banco } = bancoFalso()
        const itens = [item([{ option_id: 'o-sem-cebola', group_id: 'g-salao', name: 'Sem cebola', price: 0, quantity: 1 }], 50)]
        const r = conferirItens(itens, await carregarCatalogoDoPedido(banco, itens))
        expect(r.problemas.map((p) => p.tipo)).toEqual(['complemento_desconhecido'])
        expect(r.itens).toEqual([])
    })

    it('o adicional comum continua valendo com o preço do cadastro', async () => {
        const { banco } = bancoFalso()
        const itens = [item([{ option_id: 'o-bacon', group_id: 'g-adic', name: 'Bacon', price: 4, quantity: 1 }], 54)]
        const r = conferirItens(itens, await carregarCatalogoDoPedido(banco, itens))
        expect(r.problemas).toEqual([])
        expect(r.itens[0].unitarioNuvem).toBe(54)
    })

    it('banco sem a coluna (antes do Sincronizar): refaz a consulta de antes e o pedido não trava', async () => {
        const { banco, chamadas } = bancoFalso(true)
        const itens = [item([{ option_id: 'o-bacon', name: 'Bacon', quantity: 1 }], 54)]
        const r = conferirItens(itens, await carregarCatalogoDoPedido(banco, itens))
        expect(chamadas.length).toBe(2)
        expect(chamadas[1].complementGroups.where).toBeUndefined()
        expect(r.problemas).toEqual([])
    })
})
