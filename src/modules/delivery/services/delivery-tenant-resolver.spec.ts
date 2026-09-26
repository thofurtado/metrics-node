import { beforeEach, describe, expect, it, vi } from 'vitest'

// Três clientes de mentira: um com erro no banco, um com a loja do iFood, um com a loja da 99Food.
const bancos: Record<string, any> = {
  db_com_erro: { companyProfile: { findFirst: vi.fn().mockRejectedValue(new Error('banco fora do ar')) }, tenantIntegration: { findUnique: vi.fn().mockRejectedValue(new Error('banco fora do ar')) } },
  db_loja_ifood: { companyProfile: { findFirst: vi.fn().mockResolvedValue({ ifoodMerchantId: 'merchant-real' }) }, tenantIntegration: { findUnique: vi.fn().mockResolvedValue(null) } },
  db_loja_99: { companyProfile: { findFirst: vi.fn().mockResolvedValue({ ifoodMerchantId: null }) }, tenantIntegration: { findUnique: vi.fn().mockResolvedValue({ settings: { shopId: '99-real' } }) } },
  db_restaurante: { companyProfile: { findFirst: vi.fn() }, tenantIntegration: { findUnique: vi.fn() } },
}
const listarClientes = vi.fn().mockResolvedValue(['db_com_erro', 'db_loja_ifood', 'db_loja_99'])

vi.mock('@/lib/tenant-manager', () => ({
  getActiveTenantDbNames: () => listarClientes(),
  getPrismaForDb: async (db: string) => bancos[db],
}))

import { LojaDeliveryDesconhecida, limparCacheDeLojas, localizarTenantDaLoja, resolveTenantForMerchant } from './delivery-tenant-resolver'

describe('de qual cliente é a loja do iFood / 99Food', () => {
  beforeEach(() => {
    limparCacheDeLojas()
    listarClientes.mockClear()
  })

  it('loja de teste vai para o banco de teste sem abrir os clientes', async () => {
    expect((await resolveTenantForMerchant('0157299d-4790-4389-9703-47d56b5fe140', 'IFOOD')).dbName).toBe('db_restaurante')
    expect(listarClientes).not.toHaveBeenCalled()
  })

  it('iFood: acha o cliente pelo ID da loja, mesmo com outro banco dando erro', async () => {
    expect((await resolveTenantForMerchant('merchant-real', 'IFOOD')).dbName).toBe('db_loja_ifood')
  })

  it('99Food: acha pelo id salvo em Configurações > Integrações', async () => {
    expect((await resolveTenantForMerchant('99-real', 'FOOD99')).dbName).toBe('db_loja_99')
  })

  it('loja de ninguém NÃO cai no banco de teste', async () => {
    expect(await localizarTenantDaLoja('loja-desconhecida', 'IFOOD')).toBeNull()
    await expect(resolveTenantForMerchant('loja-desconhecida', 'IFOOD')).rejects.toBeInstanceOf(LojaDeliveryDesconhecida)
  })

  it('segunda busca da mesma loja sai da memória', async () => {
    await resolveTenantForMerchant('merchant-real', 'IFOOD')
    await resolveTenantForMerchant('merchant-real', 'IFOOD')
    expect(listarClientes).toHaveBeenCalledTimes(1)
  })
})
