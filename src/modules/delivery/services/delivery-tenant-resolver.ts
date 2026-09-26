import { getActiveTenantDbNames, getPrismaForDb } from '@/lib/tenant-manager'
import { PrismaClient } from '@prisma/client'
import { PROVEDOR_FOOD99 } from '@/modules/system-config/services/tenant-integrations'

// Pedidos do iFood e da 99Food chegam dos servidores deles, sem o domínio da loja: só com o número da loja
// na plataforma. Aqui se descobre de qual cliente (banco) é esse número.
//
// Até 25/09/2026 a busca pedia ao banco um campo "food99ShopId" que não existe: dava erro em TODOS os clientes e
// o pedido caía no db_restaurante (banco de teste). Nenhum cliente real tinha iFood ligado, então ninguém foi
// afetado. Agora: iFood pelo ID da loja no perfil da empresa; 99Food pelo id salvo em Configurações > Integrações;
// loja que não é de ninguém NÃO entra em banco nenhum (antes caía no de teste).

// Lojas de teste conhecidas: sempre o banco de teste.
const LOJAS_DE_TESTE: Record<string, string> = {
  // 99Food, loja de teste Bella Gourmet
  '5764617543416810779': 'db_restaurante',
  // iFood, loja de teste "Teste - THOMAS FURTADO"
  '4107174': 'db_restaurante',
  '0157299d-4790-4389-9703-47d56b5fe140': 'db_restaurante',
}

export type Plataforma = 'IFOOD' | 'FOOD99'

export class LojaDeliveryDesconhecida extends Error {
  constructor(public readonly merchantId: string, public readonly plataforma: Plataforma) {
    super(`Loja ${merchantId} (${plataforma === 'IFOOD' ? 'iFood' : '99Food'}) não está cadastrada em nenhum cliente ativo.`)
  }
}

// Cache de 10 minutos: não abrir o banco de todos os clientes a cada pedido.
const DEZ_MINUTOS = 10 * 60 * 1000
const cache = new Map<string, { dbName: string; expira: number }>()

export function limparCacheDeLojas() {
  cache.clear()
}

async function idDaLojaNoCliente(prisma: PrismaClient, plataforma: Plataforma): Promise<string | null> {
  if (plataforma === 'IFOOD') {
    const perfil = await (prisma as any).companyProfile.findFirst({ select: { ifoodMerchantId: true } })
    return perfil?.ifoodMerchantId ? String(perfil.ifoodMerchantId).trim() : null
  }
  const integracao = await (prisma as any).tenantIntegration.findUnique({ where: { provider: PROVEDOR_FOOD99 } })
  const shopId = (integracao?.settings as any)?.shopId
  return shopId ? String(shopId).trim() : null
}

/** Cliente dono da loja, ou null se nenhum cliente ativo tem essa loja cadastrada. */
export async function localizarTenantDaLoja(
  merchantId: string,
  plataforma: Plataforma = 'IFOOD',
): Promise<{ dbName: string; prisma: PrismaClient } | null> {
  const id = String(merchantId ?? '').trim()
  if (!id) return null

  const teste = LOJAS_DE_TESTE[id]
  if (teste) return { dbName: teste, prisma: await getPrismaForDb(teste) }

  const chave = `${plataforma}:${id}`
  const guardado = cache.get(chave)
  if (guardado && guardado.expira > Date.now()) return { dbName: guardado.dbName, prisma: await getPrismaForDb(guardado.dbName) }

  for (const dbName of await getActiveTenantDbNames()) {
    try {
      const prisma = await getPrismaForDb(dbName)
      if ((await idDaLojaNoCliente(prisma, plataforma)) === id) {
        cache.set(chave, { dbName, expira: Date.now() + DEZ_MINUTOS })
        return { dbName, prisma }
      }
    } catch (error: any) {
      // Um banco com problema (ou ainda sem a tabela de integrações) não impede achar a loja nos outros.
      console.error(`[Delivery Tenant Resolver] Falha ao consultar ${dbName}:`, error?.message || error)
    }
  }
  return null
}

/** Como localizarTenantDaLoja, mas lança LojaDeliveryDesconhecida em vez de devolver null. */
export async function resolveTenantForMerchant(
  merchantId: string,
  plataforma: Plataforma = 'IFOOD',
): Promise<{ dbName: string; prisma: PrismaClient }> {
  const achado = await localizarTenantDaLoja(merchantId, plataforma)
  if (!achado) throw new LojaDeliveryDesconhecida(String(merchantId ?? ''), plataforma)
  return achado
}
