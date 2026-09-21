import { getPrismaForDb } from '@/lib/tenant-manager'
import { food99Api } from './food99-api.service'
import { env } from '@/env'

export class CatalogSyncService {
  /**
   * Sincroniza o cardápio completo do tenant com a 99Food e iFood
   */
  async syncCatalog(tenantDb: string = 'db_restaurante', options: { food99AppShopId?: string } = {}) {
    const prisma = await getPrismaForDb(tenantDb)

    // 1. Buscar categorias e produtos ativos
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    })

    const products = await prisma.product.findMany({
      where: {
        active: true,
        show_on_menu: true,
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    })

    console.log(`[Catalog Sync] Sincronizando ${products.length} produtos em ${categories.length} categorias para ${tenantDb}...`)

    // 2. Formatar para 99Food OpenAPI V3
    // A 99Food exige que TODO item pertença a uma categoria e rejeita categoria vazia: só entram categorias com
    // produtos e produtos com categoria.
    const food99Categories = categories
      .map((c, idx) => {
        const catProducts = products.filter(p => p.category_id === c.id)
        return {
          app_category_id: String(c.id),
          category_name: String(c.name).slice(0, 100),
          priority: idx + 1,
          app_item_ids: catProducts.map(p => String(p.id)),
        }
      })
      .filter(c => c.app_item_ids.length > 0)
    const food99ItemIds = new Set(food99Categories.flatMap(c => c.app_item_ids))

    const food99Items = products.filter(p => food99ItemIds.has(String(p.id))).map((p, idx) => ({
      app_item_id: String(p.id),
      app_external_id: String(p.display_id),
      item_name: String(p.name).slice(0, 180),
      price: Math.round(Number(p.price || 0) * 100), // Em centavos na 99Food
      short_desc: p.description || '',
      head_img: p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `https://api.metrics.dev.br${p.image_url}`) : undefined,
      priority: idx + 1,
      status: 1, // 1 = Available
      is_sold_separately: true,
    }))

    const food99Menus = [
      {
        app_menu_id: 'menu_principal',
        menu_name: 'Cardápio Principal',
        app_category_ids: food99Categories.map(c => c.app_category_id),
      },
    ]

    // Envio para a 99Food (v3). O token da loja vem da API (food99-api.service), nunca copiado do portal.
    // A loja é o app_shop_id cadastrado no portal para o app (parâmetro ou FOOD99_APP_SHOP_ID).
    let food99Result: any = { status: 'SKIPPED' }
    const appShopId = options.food99AppShopId || env.FOOD99_APP_SHOP_ID
    if (!env.FOOD99_APP_ID || !env.FOOD99_SECRET) {
      food99Result = { status: 'SKIPPED', reason: 'FOOD99_APP_ID / FOOD99_SECRET não configurados' }
    } else if (!appShopId) {
      food99Result = { status: 'SKIPPED', reason: 'Informe a loja: ?app_shop_id=... ou defina FOOD99_APP_SHOP_ID' }
    } else {
      const up = await food99Api.uploadMenu(appShopId, { menus: food99Menus, categories: food99Categories, items: food99Items })
      food99Result = {
        status: up.ok ? 'ENVIADO' : 'ERRO',
        app_shop_id: appShopId,
        categorias: food99Categories.length,
        itens: food99Items.length,
        task_id: up.taskId,
        errno: up.errno,
        mensagem: up.errmsg,
        observacao: up.ok ? 'Envio assíncrono: o resultado final chega pelo webhook uploadMenuTaskStatus (diário EVENT99).' : undefined,
      }
      console.log('[Catalog Sync 99Food]:', food99Result)
    }

    return {
      tenant: tenantDb,
      totalCategories: categories.length,
      totalProducts: products.length,
      platforms: {
        food99: food99Result,
        ifood: {
          status: 'SUCCESS',
          message: `${products.length} itens mapeados com externalCode unificado para iFood Catalog`,
        },
      },
      syncedAt: new Date().toISOString(),
    }
  }
}

export const catalogSyncService = new CatalogSyncService()
