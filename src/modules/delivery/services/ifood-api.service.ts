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

export class IFoodApiService {
  private baseUrl = 'https://merchant-api.ifood.com.br'

  private async auditedFetch(url: string, init: RequestInit = {}) {
    const startedAt = Date.now()
    const method = init.method || 'GET'
    const orderId = url.match(/\/order\/(?:v\d+\.\d+\/orders\/)?([^/]+)(?:\/|$)/)?.[1]
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
        const prisma = await getPrismaForDb('db_restaurante')
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
   * Marca o pedido como pronto para entrega / retirada (RTP - Ready To Deliver)
   */
  async readyToDeliver(accessToken: string, orderId: string) {
    const response = await this.auditedFetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/readyToDeliver`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[iFood Ready To Deliver Error] (${response.status}): ${err}`)
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
        },
      })

      if (response.ok) {
        const data = await response.json()
        return Array.isArray(data) ? data : []
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
        body: JSON.stringify({}),
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
   * Confirma cancelamento recebido no fluxo de eventos do iFood.
   * Usa o mesmo endpoint exigido para o cancelamento iniciado no PDV.
   */
  async acceptCancellation(
    accessToken: string,
    orderId: string,
    reason: string = 'Cancelamento aceito pelo restaurante',
    cancellationCode: string = '501'
  ): Promise<boolean> {
    try {
      const payload = {
        reason: String(reason || 'Cancelamento aceito pelo restaurante'),
        cancellationCode: String(cancellationCode || '501'),
        code: String(cancellationCode || '501'),
      }

      // O fluxo homologado usa somente este endpoint. Não fazer fallback para
      // endpoints legados, pois isso gera chamadas POST incompatíveis e retries.
      const endpoint = `${this.baseUrl}/order/${orderId}/statuses/cancellationRequested`
      const response = await this.auditedFetch(endpoint, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      })

      if (!response.ok) {
        console.log(`[iFood Cancellation Info] PATCH ${response.status}: ${await response.text()}`)
      } else {
        console.log(`[iFood Accept Cancellation Success] (${response.status}) via PATCH /order/${orderId}/statuses/cancellationRequested`)
      }
      return response.ok
    } catch (e: any) {
      console.error('[iFood Accept Cancellation General Error]:', e.message)
      return false
    }
  }

  /**
   * Diagnóstico manual. O fluxo normal do PDV não usa este método.
   */
  async testCancellationPatch(
    accessToken: string,
    orderId: string,
    reason: string = 'Cancelado pelo operador no PDV',
    cancellationCode: string = '501'
  ) {
    const endpoint = `${this.baseUrl}/order/${orderId}/statuses/cancellationRequested`
    const payload = {
      reason: String(reason || 'Cancelado pelo operador no PDV'),
      cancellationCode: String(cancellationCode || '501'),
      code: String(cancellationCode || '501'),
    }

    console.log(`[iFood Diagnostic] Executando PATCH ${endpoint}`)
    const response = await this.auditedFetch(endpoint, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
    const responseText = await response.text()
    console.log(`[iFood Diagnostic] PATCH ${response.status} para pedido ${orderId}`)

    return {
      method: 'PATCH',
      endpoint: endpoint.replace(this.baseUrl, ''),
      status: response.status,
      ok: response.ok,
      response: auditBody(responseText),
      payload,
    }
  }

  async requestCancellation(
    accessToken: string,
    orderId: string,
    reason: string = '501',
    cancellationCode: string = '501'
  ): Promise<boolean> {

    try {
      const payload = {
        reason: String(reason || cancellationCode || '501'),
        cancellationCode: String(cancellationCode || '501'),
        code: String(cancellationCode || '501'),
      }

      const endpoint = `/order/${orderId}/statuses/cancellationRequested`
      console.log(`[iFood Cancel Order] Executando PATCH ${endpoint}`)
      const response = await this.auditedFetch(`${this.baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      })

      if (!response.ok) {
        console.error(`[iFood Cancel Order Error] PATCH ${response.status}: ${await response.text()}`)
      } else {
        console.log(`[iFood Cancel Order Success] (${response.status}) via PATCH ${endpoint} para pedido ${orderId}`)
      }

      return response.ok
    } catch (e: any) {
      console.error('[iFood Cancel Order Exception]:', e.message)
      return false
    }
  }
}

export const ifoodApi = new IFoodApiService()
