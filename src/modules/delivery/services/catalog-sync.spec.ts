import { beforeEach, describe, expect, it, vi } from 'vitest'

// Observação rápida (só no salão), 16/10/2026: o grupo marcado nunca vai no cardápio enviado à 99 nem ao iFood.
// Hoje nenhum grupo de complementos vai (modifier_groups sai vazio); o teste guarda isso: o banco de mentira devolve os
// produtos JÁ com os grupos (o comum e o de observação rápida) e o envio não pode carregar o de observação rápida.
const enviado: any[] = []

vi.mock('@/env', () => ({ env: { FOOD99_APP_ID: 'app', FOOD99_SECRET: 'segredo', FOOD99_APP_SHOP_ID: 'loja-99' } }))
vi.mock('./food99-api.service', () => ({
    food99Api: { uploadMenu: async (loja: string, menu: any) => { enviado.push({ loja, menu }); return { ok: true, taskId: 't1' } } },
}))
vi.mock('@/lib/tenant-manager', () => ({
    getPrismaForDb: async () => ({
        category: { findMany: async () => [{ id: 'c-bebidas', name: 'Bebidas' }, { id: 'c-pizzas', name: 'Pizzas' }] },
        product: {
            findMany: async () => [
                { id: 'p-coca', display_id: 1, name: 'Coca-Cola', price: 7, category_id: 'c-bebidas', description: null, image_url: null,
                  complementGroups: [{ order: 0, group: { id: 'g-gelo', name: 'Gelo e limão', quick_note: true, options: [{ id: 'o1', name: 'Sem gelo', price: 0 }] } }] },
                { id: 'p-pizza', display_id: 2, name: 'Pizza', price: 50, category_id: 'c-pizzas', description: null, image_url: null,
                  complementGroups: [
                      { order: 0, group: { id: 'g-borda', name: 'Borda', quick_note: false, options: [{ id: 'o2', name: 'Catupiry', price: 8 }] } },
                      { order: 1, group: { id: 'g-cebola', name: 'Sem cebola', quick_note: true, options: [{ id: 'o3', name: 'Sem cebola', price: 0 }] } },
                  ] },
            ],
        },
    }),
}))

import { CatalogSyncService } from './catalog-sync.service'

beforeEach(() => { enviado.length = 0 })

describe('Envio do cardápio à 99/iFood: observação rápida', () => {
    it('o grupo de observação rápida não vai no envio à 99 (e os produtos vão)', async () => {
        const r = await new CatalogSyncService().syncCatalog('db_teste')
        expect(r.platforms.food99.status).toBe('ENVIADO')
        expect(enviado).toHaveLength(1)
        const corpo = JSON.stringify(enviado[0].menu)
        expect(enviado[0].menu.items.map((i: any) => i.item_name)).toEqual(['Coca-Cola', 'Pizza'])
        expect(corpo).not.toContain('Gelo e limão')
        expect(corpo).not.toContain('Sem gelo')
        expect(corpo).not.toContain('Sem cebola')
        expect(enviado[0].menu.modifier_groups ?? []).toEqual([])
    })

    it('o iFood não recebe grupo nenhum: o resultado só conta os itens', async () => {
        const r = await new CatalogSyncService().syncCatalog('db_teste')
        expect(JSON.stringify(r.platforms.ifood)).not.toContain('Sem cebola')
    })
})
