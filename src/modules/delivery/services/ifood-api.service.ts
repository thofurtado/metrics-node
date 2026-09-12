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
   * Solicita o cancelamento do pedido no iFood
   */
  async requestCancellation(accessToken: string, orderId: string, reason: string = 'Indisponibilidade de itens ou alta demanda no restaurante', cancellationCode: string = '501') {
    const response = await fetch(`${this.baseUrl}/order/v1.0/orders/${orderId}/requestCancellation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason,
        cancellationCode,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[iFood Cancel Order Error] (${response.status}): ${err}`)
    }

    return response.ok
  }
}

export const ifoodApi = new IFoodApiService()
