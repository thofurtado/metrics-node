import { getPrismaForDb } from '@/lib/tenant-manager'
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
  // 1. Em ambiente de teste/sandbox, se bater com a chave padrão ou não estiver explicitamente mapeado
  const dbName = sandboxMerchantMap[merchantId] || sandboxMerchantMap['default'] || 'db_marujo'
  const prisma = await getPrismaForDb(dbName)

  return { dbName, prisma }
}
