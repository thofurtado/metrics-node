import type { PrismaClient } from '@prisma/client'
import { normalizarCnpj, type ConfigIbpt } from './ibpt'

// Integrações do cliente com serviços de fora (tabela tenant_integrations, uma linha por serviço).
export const PROVEDOR_IBPT = 'IBPT'
export const PROVEDOR_FOOD99 = 'FOOD99'

export class TabelaDeIntegracoesAusente extends Error {
  constructor() {
    super('A tabela de integrações ainda não existe neste banco: rode o Sincronizar no SaaS Admin.')
  }
}

// Até o Sincronizar criar a tabela (backend publicado antes), o Prisma responde P2021.
const tabelaAusente = (err: any) => err?.code === 'P2021' || /tenant_integrations.*does not exist/i.test(String(err?.message))

export async function lerIntegracao(prisma: PrismaClient, provider: string) {
  try {
    return await (prisma as any).tenantIntegration.findUnique({ where: { provider } })
  } catch (err) {
    if (tabelaAusente(err)) throw new TabelaDeIntegracoesAusente()
    throw err
  }
}

export async function salvarIntegracao(
  prisma: PrismaClient,
  provider: string,
  dados: { enabled?: boolean; settings?: Record<string, unknown> | null; secret?: string | null },
) {
  try {
    return await (prisma as any).tenantIntegration.upsert({
      where: { provider },
      update: dados,
      create: { provider, enabled: dados.enabled ?? true, settings: dados.settings ?? undefined, secret: dados.secret ?? null },
    })
  } catch (err) {
    if (tabelaAusente(err)) throw new TabelaDeIntegracoesAusente()
    throw err
  }
}

export function configIbptDaLinha(linha: any): ConfigIbpt | null {
  if (!linha) return null
  const settings = (linha.settings && typeof linha.settings === 'object') ? linha.settings as Record<string, unknown> : {}
  return { ativo: Boolean(linha.enabled), token: linha.secret || null, cnpj: normalizarCnpj(settings.cnpj) }
}

export async function lerConfigIbpt(prisma: PrismaClient): Promise<ConfigIbpt | null> {
  try {
    return configIbptDaLinha(await lerIntegracao(prisma, PROVEDOR_IBPT))
  } catch (err) {
    if (err instanceof TabelaDeIntegracoesAusente) return null
    throw err
  }
}
