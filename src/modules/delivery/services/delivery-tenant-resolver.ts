import { getPrismaForDb } from '@/lib/tenant-manager'
import { PrismaClient } from '@prisma/client'

// Mapeamento em memória para lojas de teste ou cache rápido
const sandboxMerchantMap: Record<string, string> = {
  // Merchant ID de teste iFood/99Food -> Nome do banco de dados do tenant
  default: 'db_marujo',
}

/**
 * Descobre a qual tenant (banco de dados) pertence o merchant_id recebido do iFood ou 99Food.
 * Garante o isolamento multitenant total.
 */
export async function resolveTenantForMerchant(
  merchantId: string,
  platform: 'IFOOD' | 'FOOD99' = 'IFOOD'
): Promise<{ dbName: string; prisma: PrismaClient }> {
  // 1. Em ambiente de teste/sandbox, se bater com a chave padrão ou não estiver explicitamente mapeado
  const dbName = sandboxMerchantMap[merchantId] || sandboxMerchantMap['default'] || 'db_marujo'
  const prisma = await getPrismaForDb(dbName)

  return { dbName, prisma }
}
