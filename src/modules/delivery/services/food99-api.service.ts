import { env } from '@/env'
import { writeJournal } from './ifood-events.service'
import { parseJsonKeepingLongIds } from '@/lib/json-safe-ids'

/**
 * Cliente da OpenAPI da 99Food (https://openapi.99food.com).
 *
 * O token da loja NÃO é copiado do portal: ele é obtido aqui com app_id + app_secret + app_shop_id
 * (GET /v1/auth/authtoken/get), guardado em memória até perto de expirar e renovado quando a API avisa
 * (10100/10102 → GET /v1/auth/authtoken/refresh e busca de novo). Limites da 99Food: get/refresh 1 req/30 s.
 */
const BASE = 'https://openapi.99food.com'
const TOKEN_MARGIN_S = 120

interface CachedToken {
  token: string
  expiresAt: number // epoch em segundos
  fetchedAt: number // epoch em ms
}

const tokens = new Map<string, CachedToken>()
const inflight = new Map<string, Promise<string | null>>()

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  return parseJsonKeepingLongIds(await res.text())
}

async function fetchToken(appShopId: string, forceRefresh: boolean): Promise<string | null> {
  const appId = env.FOOD99_APP_ID
  const appSecret = env.FOOD99_SECRET
  if (!appId || !appSecret) {
    console.error('[99Food API] FOOD99_APP_ID / FOOD99_SECRET não configurados no servidor.')
    return null
  }
  const q = `app_id=${encodeURIComponent(appId)}&app_secret=${encodeURIComponent(appSecret)}&app_shop_id=${encodeURIComponent(appShopId)}`

  const started = Date.now()
  try {
    if (forceRefresh) {
      const r = await getJson(`${BASE}/v1/auth/authtoken/refresh?${q}`)
      void writeJournal({ method: 'API99', endpoint: 'authtoken/refresh', request: { app_shop_id: appShopId }, response: { errno: r?.errno, errmsg: r?.errmsg, requestId: r?.requestId }, durationMs: Date.now() - started, success: r?.errno === 0, error: r?.errno === 0 ? undefined : r?.errmsg })
    }
    const t0 = Date.now()
    const d = await getJson(`${BASE}/v1/auth/authtoken/get?${q}`)
    const token = d?.data?.auth_token
    void writeJournal({ method: 'API99', endpoint: 'authtoken/get', request: { app_shop_id: appShopId }, response: { errno: d?.errno, errmsg: d?.errmsg, requestId: d?.requestId, expira_em: d?.data?.token_expiration_time }, durationMs: Date.now() - t0, success: Boolean(token), error: token ? undefined : d?.errmsg })
    if (!token) return null
    tokens.set(appShopId, { token, expiresAt: Number(d.data.token_expiration_time) || 0, fetchedAt: Date.now() })
    return token
  } catch (e: any) {
    console.error('[99Food API] Falha ao obter token da loja:', e?.message || e)
    return null
  }
}

/** Token válido da loja (cache + renovação). Uma busca por vez por loja, respeitando 1 req/30 s. */
export async function getFood99Token(appShopId: string, forceRefresh = false): Promise<string | null> {
  const cached = tokens.get(appShopId)
  const nowS = Math.floor(Date.now() / 1000)
  if (!forceRefresh && cached && (!cached.expiresAt || cached.expiresAt - nowS > TOKEN_MARGIN_S)) return cached.token
  // Evita estourar o limite: se acabamos de buscar (<30 s) e não é renovação, reaproveita.
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < 30_000) return cached.token

  const running = inflight.get(appShopId)
  if (running) return running
  const p = fetchToken(appShopId, forceRefresh).finally(() => inflight.delete(appShopId))
  inflight.set(appShopId, p)
  return p
}

export interface Food99Result {
  ok: boolean
  errno?: number
  errmsg?: string
  requestId?: string
}

/**
 * POST em /v1/order/... com auth_token. O order_id é um inteiro de 64 bits: vai no corpo como NÚMERO (texto cru),
 * sem passar por JSON.stringify de Number, que arredondaria.
 */
async function orderCall(appShopId: string, path: string, orderId: string, extra: Record<string, unknown> = {}): Promise<Food99Result> {
  if (!/^\d{1,20}$/.test(orderId)) return { ok: false, errmsg: 'order_id inválido' }

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getFood99Token(appShopId, attempt > 0)
    if (!token) return { ok: false, errmsg: 'Sem token da 99Food (verifique FOOD99_APP_ID/FOOD99_SECRET e o vínculo da loja).' }

    const extraJson = Object.keys(extra).length ? ',' + JSON.stringify(extra).slice(1, -1) : ''
    const body = `{"auth_token":${JSON.stringify(token)},"order_id":${orderId}${extraJson}}`
    const started = Date.now()
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000),
      })
      const d = parseJsonKeepingLongIds(await res.text())
      const ok = d?.errno === 0
      void writeJournal({
        method: 'API99',
        endpoint: path,
        orderId,
        request: { app_shop_id: appShopId, ...extra, tentativa: attempt + 1 },
        response: { errno: d?.errno, errmsg: d?.errmsg, requestId: d?.requestId, data: d?.data },
        status: res.status,
        durationMs: Date.now() - started,
        success: ok,
        error: ok ? undefined : d?.errmsg,
      })
      if (ok) return { ok: true, errno: 0, requestId: d?.requestId }
      // Token inválido/expirado: renova e tenta de novo uma vez.
      if ((d?.errno === 10100 || d?.errno === 10102) && attempt === 0) continue
      return { ok: false, errno: d?.errno, errmsg: d?.errmsg, requestId: d?.requestId }
    } catch (e: any) {
      void writeJournal({ method: 'API99', endpoint: path, orderId, request: { app_shop_id: appShopId }, durationMs: Date.now() - started, success: false, error: e?.message || String(e) })
      return { ok: false, errmsg: e?.message || 'Falha de rede com a 99Food' }
    }
  }
  return { ok: false, errmsg: 'Falha ao renovar o token da 99Food' }
}

/**
 * Envia o cardápio completo (v3). O envio é ASSÍNCRONO: a resposta traz um task_id e o resultado final chega
 * no webhook uploadMenuTaskStatus (fica no diário EVENT99). Exige token da loja no corpo (auth_token).
 */
async function uploadMenu(appShopId: string, menu: { menus: unknown[]; categories: unknown[]; items: unknown[]; modifier_groups?: unknown[] }): Promise<Food99Result & { taskId?: string; data?: unknown }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getFood99Token(appShopId, attempt > 0)
    if (!token) return { ok: false, errmsg: 'Sem token da 99Food (verifique FOOD99_APP_ID/FOOD99_SECRET e se a loja está vinculada a ESTE app).' }
    const started = Date.now()
    try {
      const res = await fetch(`${BASE}/v3/item/item/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token, modifier_groups: [], ...menu }),
        signal: AbortSignal.timeout(20000),
      })
      const d = parseJsonKeepingLongIds(await res.text())
      const ok = d?.errno === 0
      void writeJournal({
        method: 'API99',
        endpoint: '/v3/item/item/upload',
        request: { app_shop_id: appShopId, categorias: menu.categories.length, itens: menu.items.length, tentativa: attempt + 1 },
        response: { errno: d?.errno, errmsg: d?.errmsg, requestId: d?.requestId, data: d?.data },
        status: res.status,
        durationMs: Date.now() - started,
        success: ok,
        error: ok ? undefined : d?.errmsg,
      })
      if (ok) return { ok: true, errno: 0, requestId: d?.requestId, taskId: d?.data?.task_id != null ? String(d.data.task_id) : undefined, data: d?.data }
      if ((d?.errno === 10100 || d?.errno === 10102) && attempt === 0) continue
      return { ok: false, errno: d?.errno, errmsg: d?.errmsg, requestId: d?.requestId, data: d?.data }
    } catch (e: any) {
      return { ok: false, errmsg: e?.message || 'Falha de rede com a 99Food' }
    }
  }
  return { ok: false, errmsg: 'Falha ao renovar o token da 99Food' }
}

/** Lista o cardápio que está de fato na loja (GET /v3/item/item/list). Só leitura. */
async function listMenu(appShopId: string): Promise<{ ok: boolean; errmsg?: string; items: { app_item_id: string; item_name: string; price: number }[] }> {
  const token = await getFood99Token(appShopId)
  if (!token) return { ok: false, errmsg: 'Sem token da 99Food', items: [] }
  try {
    const d = await getJson(`${BASE}/v3/item/item/list?auth_token=${encodeURIComponent(token)}`)
    if (d?.errno !== 0) return { ok: false, errmsg: d?.errmsg, items: [] }
    return { ok: true, items: (d?.data?.items || []).map((i: any) => ({ app_item_id: String(i.app_item_id), item_name: i.item_name, price: i.price })) }
  } catch (e: any) {
    return { ok: false, errmsg: e?.message, items: [] }
  }
}

export const food99Api = {
  uploadMenu,
  listMenu,
  /** Confirma (aceita) o pedido. Obrigatório em até 5 minutos após o orderNew, senão a 99Food cancela sozinha. */
  confirmOrder: (appShopId: string, orderId: string) => orderCall(appShopId, '/v1/order/order/confirm', orderId),
  /** Pedido pronto para retirada/entrega. */
  readyOrder: (appShopId: string, orderId: string) => orderCall(appShopId, '/v1/order/order/ready', orderId),
  /** Entrega concluída (somente entrega própria da loja, delivery_type 2). */
  deliveredOrder: (appShopId: string, orderId: string) => orderCall(appShopId, '/v1/order/order/delivered', orderId),
  /** Cancela/recusa. reasonId da lista da 99Food (1010, 1020, 1030, 1040, 1050, 1060, 1070, 1071, 1072, 1073, 1074, 1080). */
  cancelOrder: (appShopId: string, orderId: string, reasonId: number, reason?: string) =>
    orderCall(appShopId, '/v1/order/order/cancel', orderId, { reason_id: reasonId, ...(reason ? { reason } : {}) }),
}

/** Motivos de cancelamento da 99Food (doc Cancel Order). 1060/1071/1072 só para entrega própria. */
export const FOOD99_CANCEL_REASONS: { id: number; label: string; ownDeliveryOnly?: boolean }[] = [
  { id: 1010, label: 'Item esgotado' },
  { id: 1020, label: 'Loja fechada por hoje' },
  { id: 1030, label: 'Loja muito ocupada para preparar o pedido' },
  { id: 1040, label: 'Acidente grave ou falta de energia/água' },
  { id: 1050, label: 'Cancelado por problema com o cliente' },
  { id: 1060, label: 'Sem entregador disponível', ownDeliveryOnly: true },
  { id: 1070, label: 'Cardápio precisa ser atualizado' },
  { id: 1071, label: 'Pedido fora da área de entrega', ownDeliveryOnly: true },
  { id: 1072, label: 'Endereço em área insegura', ownDeliveryOnly: true },
  { id: 1073, label: 'Suspeita de fraude ou trote' },
  { id: 1074, label: 'Dúvidas sobre taxas ou promoções' },
  { id: 1080, label: 'Outro motivo (informe o detalhe)' },
]
