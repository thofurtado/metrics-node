import { sseManager } from '@/lib/sse-manager'
import { ifoodApi } from './ifood-api.service'
import { localizarTenantDaLoja } from './delivery-tenant-resolver'
import { getActiveTenantDbNames, getPrismaForDb } from '@/lib/tenant-manager'

/**
 * Tratamento ÚNICO dos eventos de cancelamento do iFood (polling e webhook) + diário de eventos.
 *
 * O diário grava em ifood_api_logs (mesma tabela da auditoria das chamadas), sem migração:
 *   method = 'EVENT'  → evento recebido (canal, latência, tempo do ACK, resultado)
 *   method = 'PDV'    → passo do operador no PDV (motivos exibidos, cancelamento pedido)
 * A página /delivery/ifood/diag mostra tudo isso em ordem, com um checklist do cenário de cancelamento.
 */

export type IfoodEventSource = 'polling' | 'webhook'

export interface JournalEntry {
  method: string
  endpoint: string
  orderId?: string | null
  request?: unknown
  response?: unknown
  status?: number
  durationMs?: number
  success?: boolean
  error?: string
}

export async function writeJournal(entry: JournalEntry) {
  try {
    const prisma = await getPrismaForDb(process.env.IFOOD_AUDIT_DB || 'db_restaurante')
    await (prisma as any).ifoodApiLog.create({
      data: {
        method: entry.method,
        endpoint: entry.endpoint,
        order_id: entry.orderId || null,
        request_body: entry.request ?? undefined,
        response_status: entry.status,
        response_body: entry.response ?? undefined,
        duration_ms: Math.round(entry.durationMs ?? 0),
        success: entry.success ?? true,
        error_message: entry.error,
      },
    })
  } catch (e: any) {
    console.error('[iFood Journal Error]:', e?.message || e)
  }
}

export interface EventJournalInfo {
  /** Tempo (ms) entre receber os eventos e confirmar (ACK no polling; resposta 202 no webhook). */
  ackMs?: number
  duplicate?: boolean
  outcome?: string
  success?: boolean
  error?: string
}

export function journalEvent(event: any, source: IfoodEventSource, info: EventJournalInfo = {}) {
  const code = String(event?.code || event?.fullCode || '?')
  const createdAt = event?.createdAt ? Date.parse(String(event.createdAt)) : NaN
  return writeJournal({
    method: 'EVENT',
    endpoint: `/events/${source}/${code}`,
    orderId: event?.orderId ? String(event.orderId) : event?.order_id ? String(event.order_id) : null,
    request: event,
    response: {
      source,
      receivedAt: new Date().toISOString(),
      eventCreatedAt: event?.createdAt ?? null,
      latencyMs: Number.isFinite(createdAt) ? Date.now() - createdAt : null,
      ackMs: info.ackMs ?? null,
      duplicate: Boolean(info.duplicate),
      outcome: info.outcome ?? null,
    },
    durationMs: info.ackMs ?? 0,
    success: info.success ?? true,
    error: info.error,
  })
}

// Um mesmo evento pode chegar pelos dois canais (polling e webhook): só o primeiro é tratado.
const handledEventIds = new Set<string>()
const MAX_HANDLED_IDS = 2000

function alreadyHandled(eventId: string): boolean {
  if (!eventId) return false
  if (handledEventIds.has(eventId)) return true
  handledEventIds.add(eventId)
  if (handledEventIds.size > MAX_HANDLED_IDS) {
    const oldest = handledEventIds.values().next().value
    if (oldest) handledEventIds.delete(oldest)
  }
  return false
}

export function isCancellationRelatedEvent(event: any): boolean {
  const code = String(event?.code || '').toUpperCase()
  const fullCode = String(event?.fullCode || '').toUpperCase()
  return (
    ['HSD', 'CAR', 'CARF', 'CAN'].includes(code) ||
    ['HANDSHAKE_DISPUTE', 'CANCELLATION_REQUESTED', 'CANCELLATION_REQUEST_FAILED', 'CANCELLED'].includes(fullCode)
  )
}

/**
 * HSD  (HANDSHAKE_DISPUTE)             → aceita a disputa pelo endpoint de disputas
 * CAR  (CANCELLATION_REQUESTED)         → solicitação registrada; nada muda localmente
 * CARF (CANCELLATION_REQUEST_FAILED)    → iFood recusou; avisa os PDVs
 * CAN  (CANCELLED)                      → cancela o pedido local (não cria pedido se não existir)
 * Retorna um texto curto do que foi feito (vai para o diário).
 */
export async function processCancellationEvent(event: any, token: string | undefined, source: IfoodEventSource): Promise<string> {
  const code = String(event?.code || '').toUpperCase()
  const fullCode = String(event?.fullCode || '').toUpperCase()
  const orderId = String(event?.orderId || event?.order_id || '')
  if (alreadyHandled(String(event?.id || ''))) return 'duplicado (já tratado por outro canal)'

  if (code === 'HSD' || fullCode === 'HANDSHAKE_DISPUTE') {
    const disputeId = String(event?.metadata?.disputeId || event?.disputeId || '')
    if (!disputeId) return 'disputa sem disputeId (nada feito)'
    if (!token) return `disputa ${disputeId}: sem token para responder`
    const accepted = await ifoodApi.acceptDispute(token, disputeId).catch(() => false)
    return accepted ? `disputa ${disputeId} aceita` : `disputa ${disputeId}: falha ao aceitar`
  }

  if (code === 'CAR' || fullCode === 'CANCELLATION_REQUESTED') {
    return 'solicitação de cancelamento registrada; aguardando CANCELLED'
  }

  if (code === 'CARF' || fullCode === 'CANCELLATION_REQUEST_FAILED') {
    try {
      sseManager.broadcast('ifood_cancellation_failed', { order_id: orderId, metadata: event?.metadata || {} })
    } catch (_) {}
    return 'cancelamento RECUSADO pelo iFood; pedido segue ativo'
  }

  if ((code === 'CAN' || fullCode === 'CANCELLED') && orderId) {
    const cancelReason = String(
      event?.metadata?.reason ||
        event?.metadata?.details ||
        event?.metadata?.cancellationReason ||
        event?.metadata?.CANCEL_REASON ||
        'Cancelado no iFood',
    )
    const merchantId = String(event?.merchantId || event?.merchant_id || '')
    // Loja sem cliente cadastrado: procura o pedido em todos os clientes (ele só existe onde foi gravado).
    const dono = await localizarTenantDaLoja(merchantId, 'IFOOD')
    const tenantDbName = dono?.dbName ?? ''

    let targetPrisma: any = dono?.prisma ?? null
    let targetDbName = tenantDbName
    const where = { observacao: { contains: `[iFood:${orderId}]` } }
    let order = dono ? await (dono.prisma as any).pedido.findFirst({ where }) : null

    if (!order) {
      for (const otherDb of await getActiveTenantDbNames()) {
        if (otherDb === tenantDbName) continue
        try {
          const otherPrisma = await getPrismaForDb(otherDb)
          const found = await (otherPrisma as any).pedido.findFirst({ where })
          if (found) {
            order = found
            targetPrisma = otherPrisma
            targetDbName = otherDb
            break
          }
        } catch (_) {}
      }
    }

    if (!order) return `CANCELLED de ${orderId} sem pedido local (nada a atualizar)`

    await targetPrisma.pedido.update({
      where: { id: order.id },
      data: {
        status: 'Cancelado',
        status_delivery: 'Cancelado',
        motivo_cancelamento: cancelReason,
        data_fechamento: new Date(),
      },
    })
    const dto = { order_id: order.uuid, display_id: order.display_id, status: 'Cancelado', status_delivery: 'Cancelado' }
    sseManager.broadcast('order_status_change', dto)
    sseManager.notifyTenant(targetDbName, 'order_status_change', dto)
    return `pedido #${order.display_id} marcado como Cancelado (${source})`
  }

  return 'evento de cancelamento sem orderId'
}
