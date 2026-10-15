import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { prisma } from '@/lib/prisma'
import { lerIntegracao, salvarIntegracao, TabelaDeIntegracoesAusente, PROVEDOR_FOOD99 } from '../../services/tenant-integrations'
import { limparCacheDeLojas } from '@/modules/delivery/services/delivery-tenant-resolver'
import { food99Api } from '@/modules/delivery/services/food99-api.service'
import { appShopIdPadrao, decidirEnvioDoCardapio } from '@/modules/delivery/services/food99-loja'
import { catalogSyncService } from '@/modules/delivery/services/catalog-sync.service'

/** App Shop ID salvo da loja; sem nenhum, cria o padrão (metrics-<loja>) e salva, para a 99 e o webhook acharem a loja. */
async function appShopIdDaLoja(): Promise<string> {
  const atual = await lerIntegracao(prisma, PROVEDOR_FOOD99)
  const salvo = String((atual?.settings as any)?.shopId ?? '').trim()
  if (salvo) return salvo
  const dbName = String((requestContext.get as any)('tenant') ?? '')
  const novo = appShopIdPadrao(dbName)
  if (!novo) throw new Error('Loja não identificada.')
  await salvarIntegracao(prisma, PROVEDOR_FOOD99, { enabled: true, settings: { shopId: novo } })
  limparCacheDeLojas()
  return novo
}

/** GET /settings/integrations/food99/authorization-url: endereço para o dono da loja autorizar o Metrics na 99. */
export async function getFood99AuthorizationUrl(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const shopId = await appShopIdDaLoja()
    const r = await food99Api.getAuthorizationUrl(shopId)
    if (!r.url) return reply.status(502).send({ message: `A 99 não devolveu o endereço de autorização (${r.errmsg || 'sem resposta'}).`, shopId })
    return reply.send({ url: r.url, shopId })
  } catch (err: any) {
    if (err instanceof TabelaDeIntegracoesAusente) return reply.status(503).send({ message: err.message })
    return reply.status(500).send({ message: err?.message || 'Falha ao gerar o endereço de autorização.' })
  }
}

/** GET /settings/integrations/food99/menu: o cardápio que a loja tem de fato na 99 (só leitura). */
export async function getFood99Menu(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const shopId = await appShopIdDaLoja()
    const lista = await food99Api.listMenu(shopId)
    if (!lista.ok) return reply.status(502).send({ message: `A 99 não devolveu o cardápio (${lista.errmsg || 'sem resposta'}). A loja já autorizou o Metrics?`, shopId, items: [] })
    return reply.send({ shopId, items: lista.items })
  } catch (err: any) {
    if (err instanceof TabelaDeIntegracoesAusente) return reply.status(503).send({ message: err.message })
    return reply.status(500).send({ message: err?.message || 'Falha ao ler o cardápio da 99.' })
  }
}

/**
 * POST /settings/integrations/food99/catalog: manda o cardápio do Metrics para a 99 SÓ se a loja não tem nenhum item lá
 * (loja nova). Antes era GET/POST /delivery/catalog/sync, sem login e sem essa trava (12/10/2026).
 */
export async function postFood99Catalog(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const shopId = await appShopIdDaLoja()
    const decisao = decidirEnvioDoCardapio(await food99Api.listMenu(shopId))
    if (!decisao.pode) return reply.status(409).send({ message: decisao.motivo, shopId })
    const dbName = String((requestContext.get as any)('tenant') ?? '')
    const result = await catalogSyncService.syncCatalog(dbName, { food99AppShopId: shopId })
    // Fase 4 do Mergulho (10:N6): a 99 recusar o envio (ou faltar configuração) voltava como sucesso para a tela (424, e não 502:
    // o Cloudflare esconde o corpo do 502 e a tela não mostraria o motivo)
    const envio: any = result.platforms.food99
    if (envio?.status !== 'ENVIADO') {
      return reply.status(424).send({ message: `A 99 não recebeu o cardápio: ${envio?.mensagem || envio?.reason || 'sem resposta'}.`, shopId, ...result })
    }
    // Onde conferir: a 99 processa o cardápio depois; o resultado fica no diário e na tela de Integrações
    return reply.send({ message: 'Cardápio enviado para a 99. Ela processa em cerca de 1 minuto: depois toque em "Ver cardápio da 99" para conferir os itens que entraram.', shopId, ...result })
  } catch (err: any) {
    if (err instanceof TabelaDeIntegracoesAusente) return reply.status(503).send({ message: err.message })
    return reply.status(500).send({ message: err?.message || 'Falha ao enviar o cardápio para a 99.' })
  }
}
