import axios from 'axios'

export interface HeadscaleNode {
  id: string
  name: string
  user: string
  ipAddresses: string[]
  online: boolean
  lastSeen: string
  createdAt: string
}

export class HeadscaleService {
  private static baseUrl = process.env.HEADSCALE_URL || 'https://vpn.metrics.dev.br'
  private static apiKey = process.env.HEADSCALE_API_KEY || ''

  private static getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  static async createOrGetUser(username: string): Promise<{ success: boolean; user: string }> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!this.apiKey) {
      return { success: true, user: cleanUser }
    }

    try {
      await axios.post(
        `${this.baseUrl}/api/v1/user`,
        { name: cleanUser },
        { headers: this.getHeaders(), timeout: 5000 }
      )
      return { success: true, user: cleanUser }
    } catch (error: any) {
      return { success: true, user: cleanUser }
    }
  }

  static async createPreAuthKey(username: string, reusable = true): Promise<string> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!this.apiKey) {
      return `hskey-metrics-${cleanUser}-preauth`
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/preauthkey`,
        {
          user: cleanUser,
          reusable,
          ephemeral: false,
          expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { headers: this.getHeaders(), timeout: 5000 }
      )

      return response.data.preAuthKey?.key || `hskey-metrics-${cleanUser}-preauth`
    } catch (error: any) {
      console.warn(`[HeadscaleService] Falha ao gerar chave via API: ${error.message}. Usando fallback.`)
      return `hskey-metrics-${cleanUser}-preauth`
    }
  }

  static async listNodes(username?: string): Promise<HeadscaleNode[]> {
    if (!this.apiKey) {
      return []
    }

    try {
      const url = username
        ? `${this.baseUrl}/api/v1/node?user=${username}`
        : `${this.baseUrl}/api/v1/node`

      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 5000,
      })

      const nodes = response.data.nodes || []
      return nodes.map((n: any) => ({
        id: String(n.id),
        name: n.name || n.givenName || 'Dispositivo Desconhecido',
        user: n.user?.name || '',
        ipAddresses: n.ipAddresses || [],
        online: Boolean(n.online),
        lastSeen: n.lastSeen || '',
        createdAt: n.createdAt || '',
      }))
    } catch (error: any) {
      console.warn(`[HeadscaleService] Erro ao listar nós: ${error.message}`)
      return []
    }
  }
}
