import { getActiveTenantDbNames, getPrismaForDb } from '@/lib/tenant-manager'
import { PrismaClient } from '@prisma/client'

// Mapeamento em memória para lojas de teste ou cache rápido
const sandboxMerchantMap: Record<string, string> = {
  // 99Food Loja de teste: Bella Gourmet
  '5764617543416810779': 'db_restaurante',
  // iFood Loja de teste: Teste - THOMAS FURTADO
  '4107174': 'db_restaurante',
  '0157299d-4790-4389-9703-47d56b5fe140': 'db_restaurante',
  default: 'db_restaurante',
}

/**
 * Descobre a qual tenant (banco de dados) pertence o merchant_id recebido do iFood ou 99Food.
 * Garante o isolamento multitenant total.
 */
export async function resolveTenantForMerchant(
  merchantId: string,
  platform: 'IFOOD' | 'FOOD99' = 'IFOOD'
): Promise<{ dbName: string; prisma: PrismaClient }> {
    // 1. Mantém os mapeamentos conhecidos de sandbox.
  const mappedDbName = sandboxMerchantMap[merchantId]
  if (mappedDbName) {
    return { dbName: mappedDbName, prisma: await getPrismaForDb(mappedDbName) }
  }

  // 2. Em produção, o Merchant ID é salvo no perfil do tenant.
  // Consultamos somente tenants ativos para preservar o isolamento entre lojas.
  const tenantNames = await getActiveTenantDbNames()
  for (const dbName of tenantNames) {
    try {
      const prisma = await getPrismaForDb(dbName)
      const profile = await (prisma as any).companyProfile.findFirst({
        select: { ifoodMerchantId: true, food99ShopId: true },
      })
      const configuredMerchant = platform === 'IFOOD' ? profile?.ifoodMerchantId : profile?.food99ShopId
      if (configuredMerchant && String(configuredMerchant) === merchantId) {
        return { dbName, prisma }
      }
    } catch (error: any) {
      console.error(`[Delivery Tenant Resolver] Falha ao consultar ${dbName}:`, error?.message || error)
    }
  }

  // Compatibilidade com a loja de teste existente quando o tenant ainda não foi provisionado no master.
  const fallbackDbName = sandboxMerchantMap.default || 'db_marujo'
  return { dbName: fallbackDbName, prisma: await getPrismaForDb(fallbackDbName) }
}
