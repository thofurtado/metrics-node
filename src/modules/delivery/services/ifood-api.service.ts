import { env } from '@/env'

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

  private getClientId(): string {
    return env.IFOOD_CLIENT_ID || 'bb0c418d-1cfe-4ad1-a5c4-3bdcb26dc3c1'
  }

  private getClientSecret(): string {
    return env.IFOOD_CLIENT_SECRET || 'jj2ux14gk12cefyb4i6ydpxt1jnrzw2p7swjd078ghhhvaa5ew3d62vbedowxhrcwgo6o0stsycs0atc0me6ep2suk7n27c3v22'
  }

  /**
   * Gera o userCode para autorização OAuth2 Distribuída do lojista
   */
  async generateUserCode(): Promise<UserCodeResponse> {
    const params = new URLSearchParams()
    params.append('clientId', this.getClientId())

    const response = await fetch(`${this.baseUrl}/authentication/v1.0/oauth/userCode`, {
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
    const params = new URLSearchParams()
    params.append('grantType', 'authorization_code')
    params.append('clientId', this.getClientId())
    params.append('clientSecret', this.getClientSecret())
    params.append('authorizationCode', authorizationCode)
    params.append('authorizationCodeVerifier', authorizationCodeVerifier)

    const response = await fetch(`${this.baseUrl}/authentication/v1.0/oauth/token`, {
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
    const params = new URLSearchParams()
    params.append('grantType', 'refresh_token')
    params.append('clientId', this.getClientId())
    params.append('clientSecret', this.getClientSecret())
    params.append('refreshToken', refreshToken)

    const response = await fetch(`${this.baseUrl}/authentication/v1.0/oauth/token`, {
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
    const response = await fetch(`${this.baseUrl}/order/v1.0/events:polling`, {
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
    const response = await fetch(`${this.baseUrl}/order/v1.0/events/acknowledgment`, {
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
    const response = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}`, {
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
    const response = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/confirm`, {
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
    const response = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/dispatch`, {
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
    const response = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/readyToDeliver`, {
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
      const response = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/cancellationReasons`, {
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
      const response = await fetch(`${this.baseUrl}/order/v1.0/disputes/${disputeId}/accept`, {
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
   * Aceita cancelamento solicitado pelo consumidor / iFood (Handshake accept-cancellation)
   * Endpoint: /order/v1.0/orders/{orderId}/statuses/cancellation/accept-cancellation
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

      // 1. Tenta endpoint da plataforma de negociação (Handshake accept-cancellation)
      try {
        const respAccept = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/statuses/cancellation/accept-cancellation`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000),
        })

        if (respAccept.ok) {
          console.log(`[iFood Accept Cancellation Success] (${respAccept.status}) via statuses/cancellation/accept-cancellation para pedido ${orderId}`)
          return true
        } else {
          const errAccept = await respAccept.text()
          console.log(`[iFood Accept Cancellation Info] (${respAccept.status}): ${errAccept}`)
        }
      } catch (accEx: any) {
        console.log('[iFood Accept Cancellation Exception]:', accEx.message)
      }

      // 2. Fallback para requestCancellation (tenta statuses/cancellation/request-cancellation e requestCancellation legado)
      return await this.requestCancellation(accessToken, orderId, reason, cancellationCode)
    } catch (e: any) {
      console.error('[iFood Accept Cancellation General Error]:', e.message)
      return await this.requestCancellation(accessToken, orderId, reason, cancellationCode)
    }
  }

  /**
   * Solicita / Confirma cancelamento do pedido no iFood com os parâmetros exigidos (cancellationCode obrigatório)
   * Tenta:
   * 1. /order/v1.0/orders/{orderId}/statuses/cancellation/request-cancellation (Exigido pelo Toqan)
   * 2. /order/v1.0/orders/{orderId}/requestCancellation (Endpoint legado v1.0)
   */
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

      // Tentativa 1: Endpoint moderno de statuses/cancellation (citado nominalmente pelo Toqan)
      try {
        const respModern = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/statuses/cancellation/request-cancellation`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000),
        })

        if (respModern.ok) {
          console.log(`[iFood Cancel Order Success] (${respModern.status}) via statuses/cancellation/request-cancellation para pedido ${orderId}`)
          return true
        } else {
          const errModern = await respModern.text()
          console.log(`[iFood Modern Cancel Info] (${respModern.status}): ${errModern}`)
        }
      } catch (modErr: any) {
        console.log('[iFood Modern Cancel Warning]:', modErr.message)
      }

      // Tentativa 2: Endpoint clássico v1.0
      const response = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/requestCancellation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error(`[iFood Cancel Order Error] (${response.status}): ${err}`)
      } else {
        console.log(`[iFood Cancel Order Success] (${response.status}) para pedido ${orderId} com código ${payload.cancellationCode}`)
      }

      return response.ok
    } catch (e: any) {
      console.error('[iFood Cancel Order Exception]:', e.message)
      return false
    }
  }
}

export const ifoodApi = new IFoodApiService()
