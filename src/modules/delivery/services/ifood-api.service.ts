import { env } from '@/env'
import { getPrismaForDb, getIfoodCredentials } from '@/lib/tenant-manager'

const MAX_AUDIT_BODY_LENGTH = 10000

function redactAuditBody(value: unknown): unknown {
  if (typeof value !== 'string') return value

  const text = value.slice(0, MAX_AUDIT_BODY_LENGTH)
  try {
    return redactAuditBody(JSON.parse(text))
  } catch {
    if (text.includes('=')) {
      const params = new URLSearchParams(text)
      for (const key of ['clientSecret', 'refreshToken', 'accessToken', 'password', 'token']) {
        if (params.has(key)) params.set(key, '[REDACTED]')
      }
      return params.toString()
    }
    return text
  }
}

function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditValue)
  if (!value || typeof value !== 'object') return value

  const sensitiveKeys = new Set(['authorization', 'accessToken', 'refreshToken', 'clientSecret', 'client_secret', 'password', 'token'])
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    sensitiveKeys.has(key) ? '[REDACTED]' : redactAuditValue(item),
  ]))
}

function auditBody(value: unknown): any {
  const redacted = redactAuditValue(redactAuditBody(value))
  if (typeof redacted === 'string') return redacted.slice(0, MAX_AUDIT_BODY_LENGTH)
  return redacted
}



interface UserCodeResponse {
  userCode: string
  authorizationCodeVerifier: string
  verificationUrl: string
  verificationUrlComplete: string
  expiresIn: number
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
  type: string
  expiresIn: number
}

/** Motivo de cancelamento devolvido por GET /orders/{id}/cancellationReasons (valem só para o momento atual do pedido). */
export interface IfoodCancellationReason {
  code: string
  description: string
}

export interface IfoodCancelResult {
  ok: boolean
  message?: string
  code?: string
  /** Status HTTP e corpo (resumido) da última resposta do iFood, para o operador e o diário. */
  ifoodStatus?: number
  ifoodError?: string
}

function shortText(s?: string, n = 240): string {
  const v = (s || '').replace(/\s+/g, ' ').trim()
  return v.length > n ? v.slice(0, n) + '…' : v
}

/** Tradução curta do que o iFood respondeu, para a mensagem mostrada no PDV. */
function explainIfoodStatus(status: number): string {
  if (status === 400 || status === 404 || status === 409) {
    return 'O pedido pode já ter sido concluído ou cancelado no iFood, ou não estar mais em um momento que permita cancelar.'
  }
  if (status === 401 || status === 403) return 'O iFood recusou o acesso (token expirado ou sem permissão).'
  return 'O iFood não respondeu como esperado.'
}

export class IFoodApiService {
  // Produção por padrão. Para homologação, configure IFOOD_API_URL no deploy
  // com a URL oficial de sandbox informada pelo iFood Developer.
  private get baseUrl() {
    return (process.env.IFOOD_API_URL || 'https://merchant-api.ifood.com.br').replace(/\/$/, '')
  }

  private async auditedFetch(url: string, init: RequestInit = {}) {
    const startedAt = Date.now()
    const method = init.method || 'GET'
    // Extrai somente o UUID após /orders/. A regex anterior capturava "v1.0".
    const orderId = url.match(/\/order(?:\/v\d+\.\d+\/orders)?\/([0-9a-fA-F-]{36})/)?.[1] || url.match(/\/order\/v\d+\.\d+\/orders\/([^/?#]+)/)?.[1]
    let response: Response | undefined
    let errorMessage: string | undefined

    try {
      response = await fetch(url, init)
      return response
    } catch (error: any) {
      errorMessage = error?.message || String(error)
      throw error
    } finally {
      const responseBody = response ? await response.clone().text().catch(() => '') : undefined
      try {
        const auditDbName = process.env.IFOOD_AUDIT_DB || 'db_restaurante'
        const prisma = await getPrismaForDb(auditDbName)
        await (prisma as any).ifoodApiLog.create({
          data: {
            method,
            endpoint: url.replace(this.baseUrl, ''),
            order_id: orderId,
            request_body: init.body ? auditBody(init.body) : undefined,
            response_status: response?.status,
            response_body: responseBody ? auditBody(responseBody) : undefined,
            duration_ms: Date.now() - startedAt,
            success: Boolean(response?.ok),
            error_message: errorMessage,
          },
        })
      } catch (auditError: any) {
        console.error('[iFood Audit Log Error]:', auditError?.message || auditError)
      }
    }
  }


  private async getCredentials() {
    const configured = await getIfoodCredentials()
    if (configured) return configured
    if (env.IFOOD_CLIENT_ID && env.IFOOD_CLIENT_SECRET) {
      return { clientId: env.IFOOD_CLIENT_ID, clientSecret: env.IFOOD_CLIENT_SECRET }
    }
    throw new Error('Credenciais globais do iFood não configuradas no Admin SaaS')
  }

  /**
   * Gera o userCode para autorização OAuth2 Distribuída do lojista
   */
  async generateUserCode(): Promise<UserCodeResponse> {
        const credentials = await this.getCredentials()
    const params = new URLSearchParams()
    params.append('clientId', credentials.clientId)

    const response = await this.auditedFetch(`${this.baseUrl}/authentication/v1.0/oauth/userCode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Erro ao gerar userCode iFood (${response.status}): ${errText}`)
    }

    return response.json()
  }

  /**
   * Troca o authorizationCode obtido após aprovação do lojista por tokens de acesso
   */
  async exchangeCodeForToken(authorizationCode: string, authorizationCodeVerifier: string): Promise<TokenResponse> {
        const credentials = await this.getCredentials()
    const params = new URLSearchParams()
    params.append('grantType', 'authorization_code')
    params.append('clientId', credentials.clientId)
    params.append('clientSecret', credentials.clientSecret)
    params.append('authorizationCode', authorizationCode)
    params.append('authorizationCodeVerifier', authorizationCodeVerifier)

    const response = await this.auditedFetch(`${this.baseUrl}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Erro ao trocar token iFood (${response.status}): ${errText}`)
    }

    return response.json()
  }

  /**
   * Renova o access token usando o refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
        const credentials = await this.getCredentials()
    const params = new URLSearchParams()
    params.append('grantType', 'refresh_token')
    params.append('clientId', credentials.clientId)
    params.append('clientSecret', credentials.clientSecret)
    params.append('refreshToken', refreshToken)

    const response = await this.auditedFetch(`${this.baseUrl}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Erro ao renovar token iFood (${response.status}): ${errText}`)
    }

    return response.json()
  }


  /**
   * Busca a fila de eventos do iFood (Polling)
   */
  getApiBaseUrl() {
    return this.baseUrl
  }

  async getEvents(accessToken: string) {
    const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/events:polling`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 204) {
      // 204 No Content = nenhum evento novo na fila
      return []
    }

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Erro ao consultar eventos iFood (${response.status}): ${errText}`)
    }

    return response.json()
  }

  /**
   * Envia ACK para confirmar o recebimento dos eventos e limpar da fila
   */
  async acknowledgeEvents(accessToken: string, eventIds: string[]) {
    const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/events/acknowledgment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventIds.map((id) => ({ id }))),
    })

    return response.ok
  }

  /**
   * Busca os detalhes completos de um pedido
   */
  async getOrderDetails(accessToken: string, orderId: string) {
    const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Erro ao buscar pedido ${orderId} no iFood: ${errText}`)
    }

    return response.json()
  }

  /**
   * Confirma o pedido
   */
  async confirmOrder(accessToken: string, orderId: string) {
    const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.ok
  }

  /**
   * Despacha o pedido para entrega
   */
  async dispatchOrder(accessToken: string, orderId: string) {
    const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.ok
  }

    /**
   * Marca o pedido como pronto para retirada (RTP - Ready To Pickup)
   */
  async readyToPickup(accessToken: string, orderId: string) {
    const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/readyToPickup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[iFood Ready To Pickup Error] (${response.status}): ${err}`)
    }

    return response.ok
  }

  /**
   * Consulta motivos de cancelamento disponíveis para o pedido (Obrigatório na homologação iFood)
   */
  async getCancellationReasons(accessToken: string, orderId: string): Promise<any[]> {
    try {
      const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/cancellationReasons`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) return data
        if (data && Array.isArray(data.reasons)) return data.reasons
        return []
      }

      const err = await response.text()
      console.log(`[iFood Cancellation Reasons] (${response.status}): ${err}`)
      return []
    } catch (e: any) {
      console.error('[iFood Cancellation Reasons Exception]:', e.message)
      return []
    }
  }

  /**
   * Aceita disputa aberta pelo consumidor ou pelo iFood (HANDSHAKE_DISPUTE / HSD)
   */
  async acceptDispute(accessToken: string, disputeId: string): Promise<boolean> {
    try {
      const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/disputes/${disputeId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'CUSTOMER_SATISFACTION',
          detailReason: 'Cancelamento e reembolso aceitos pelo restaurante',
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error(`[iFood Accept Dispute Error] (${response.status}): ${err}`)
      }

      return response.ok
    } catch (e: any) {
      console.error('[iFood Accept Dispute Exception]:', e.message)
      return false
    }
  }

  /**
   * Lista os motivos de cancelamento válidos para o momento atual do pedido.
   * Obrigatório na homologação: chamar ANTES de cancelar, com o pedido ainda cancelável, e mostrar a lista ao operador.
   */
  async listCancellationReasons(
    accessToken: string,
    orderId: string,
  ): Promise<{ ok: boolean; status: number; reasons: IfoodCancellationReason[]; error?: string }> {
    try {
      const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/cancellationReasons`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.text()
        console.warn(`[iFood Cancellation Reasons] (${response.status}) pedido ${orderId}: ${error}`)
        return { ok: false, status: response.status, reasons: [], error }
      }

      // O iFood responde 2xx SEM corpo quando o pedido não pode mais ser cancelado (já concluído/cancelado).
      const bodyText = await response.text()
      let data: any = []
      if (bodyText.trim()) {
        try {
          data = JSON.parse(bodyText)
        } catch {
          return { ok: false, status: response.status, reasons: [], error: `resposta inválida: ${shortText(bodyText, 160)}` }
        }
      }
      const raw: any[] = Array.isArray(data) ? data : Array.isArray(data?.reasons) ? data.reasons : []
      const reasons = raw
        .map((r: any) => ({
          code: String(r?.cancelCodeId ?? r?.code ?? r?.cancellationCode ?? r?.id ?? ''),
          description: String(r?.description ?? r?.reason ?? r?.name ?? ''),
        }))
        .filter((r) => r.code)
      return { ok: true, status: response.status, reasons }
    } catch (e: any) {
      console.error('[iFood Cancellation Reasons Exception]:', e?.message)
      return { ok: false, status: 0, reasons: [], error: e?.message }
    }
  }

  /**
   * Cancelamento iniciado pelo PDV (fluxo exigido na homologação):
   * 1. GET /orders/{id}/cancellationReasons  (lista real, nunca fixa)
   * 2. o código escolhido pelo operador precisa estar nessa lista
   * 3. POST /orders/{id}/requestCancellation  { reason, cancellationCode }
   * O pedido só é considerado cancelado quando chega o evento CANCELLED (CAN) no polling.
   */
  async cancelOrderFromPdv(
    accessToken: string,
    orderId: string,
    choice: { code?: string; reason?: string } = {},
  ): Promise<IfoodCancelResult> {
    const list = await this.listCancellationReasons(accessToken, orderId)
    if (!list.ok || list.reasons.length === 0) {
      return {
        ok: false,
        ifoodStatus: list.status,
        ifoodError: shortText(list.error),
        message: list.ok
          ? 'O iFood não tem motivos de cancelamento para este pedido agora. Ele pode já ter sido concluído ou cancelado no iFood.'
          : `O iFood não liberou os motivos de cancelamento (resposta ${list.status}). ${explainIfoodStatus(list.status)}`,
      }
    }

    let selected: IfoodCancellationReason | undefined
    if (choice.code) {
      selected = list.reasons.find((r) => r.code === String(choice.code))
      if (!selected) {
        return { ok: false, message: 'O motivo escolhido não é válido para este pedido no iFood. Atualize a lista e escolha de novo.' }
      }
    } else {
      // Chamadas sem escolha explícita (fluxos antigos) usam o primeiro motivo REAL da lista.
      selected = list.reasons[0]
      console.warn(`[iFood Cancel] Pedido ${orderId} cancelado sem motivo escolhido; usando "${selected.description}" (${selected.code}).`)
    }

    const reasonText = (choice.reason && choice.reason.trim()) || selected.description || selected.code
    const sent = await this.requestCancellation(accessToken, orderId, reasonText, selected.code)
    return sent.ok
      ? { ok: true, code: selected.code, ifoodStatus: sent.status }
      : {
          ok: false,
          code: selected.code,
          ifoodStatus: sent.status,
          ifoodError: shortText(sent.error),
          message: `O iFood recusou a solicitação de cancelamento (resposta ${sent.status || 'sem resposta'}). ${explainIfoodStatus(sent.status)}`,
        }
  }

  /** Mantido por compatibilidade com rotas de diagnóstico. */
  async testCancellationPatch(accessToken: string, orderId: string, reason?: string, cancellationCode?: string) {
    const result = await this.cancelOrderFromPdv(accessToken, orderId, { code: cancellationCode, reason })
    return {
      method: 'POST',
      endpoint: `/order/v1.0/orders/${orderId}/requestCancellation`,
      ok: result.ok,
      orderId,
      reason,
      cancellationCode: result.code ?? cancellationCode,
      message: result.message,
    }
  }

  /**
   * POST /order/v1.0/orders/{orderId}/requestCancellation
   * Corpo oficial: { reason: texto do motivo, cancellationCode: código vindo de /cancellationReasons }.
   * Resposta 202 = solicitação aceita (o cancelamento efetivo chega depois pelo evento CANCELLED).
   */
  async requestCancellation(
    accessToken: string,
    orderId: string,
    reason: string,
    cancellationCode: string,
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    try {
      const payload = { reason, cancellationCode: String(cancellationCode) }
      const endpoint = `/order/v1.0/orders/${orderId}/requestCancellation`
      console.log(`[iFood Cancel Order] POST ${endpoint}`, payload)
      const response = await this.auditedFetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      })

      if (!response.ok) {
        const responseText = await response.text()
        const alreadyCancelled =
          (response.status === 400 || response.status === 409) &&
          /already|cancelled|cancelado|in progress|finalizado/i.test(responseText)
        if (alreadyCancelled) {
          console.log(`[iFood Cancel Order] Pedido ${orderId} já estava cancelado ou em cancelamento (idempotente).`)
          return { ok: true, status: response.status }
        }
        console.error(`[iFood Cancel Order Error] POST ${response.status}: ${responseText}`)
        return { ok: false, status: response.status, error: responseText }
      }

      console.log(`[iFood Cancel Order] (${response.status}) solicitação aceita para o pedido ${orderId}; aguardando evento CANCELLED.`)
      return { ok: true, status: response.status }
    } catch (e: any) {
      console.error('[iFood Cancel Order Exception]:', e?.message)
      return { ok: false, status: 0, error: e?.message }
    }
  }
}

export const ifoodApi = new IFoodApiService()
