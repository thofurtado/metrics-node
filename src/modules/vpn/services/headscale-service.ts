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
  static lastError: string | null = null;
  
  private static get baseUrl() {
    return process.env.HEADSCALE_URL || 'https://vpn.metrics.dev.br'
  }
  
  private static get apiKey() {
    return (process.env.HEADSCALE_API_KEY || '').trim()
  }

  private static getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  static async getUserId(username: string): Promise<number | string | null> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!this.apiKey) return null

    try {
      // 1. Tenta listar usuários existentes para obter o ID numérico (uint64)
      const getRes = await axios.get(`${this.baseUrl}/api/v1/user`, {
        headers: this.getHeaders(),
        timeout: 5000,
      })
      const users = getRes.data?.users || []
      const found = users.find((u: any) => (u.name || '').toLowerCase() === cleanUser)
      if (found && found.id !== undefined) {
        return Number(found.id)
      }

      // 2. Se não encontrou, tenta criar o usuário
      const postRes = await axios.post(
        `${this.baseUrl}/api/v1/user`,
        { name: cleanUser },
        { headers: this.getHeaders(), timeout: 5000 }
      )
      const created = postRes.data?.user
      if (created && created.id !== undefined) {
        return Number(created.id)
      }

      return null
    } catch (error: any) {
      console.warn(`[HeadscaleService] Aviso ao buscar/criar usuário: ${error.response?.data?.message || error.message}`)
      return null
    }
  }

  static async createOrGetUser(username: string): Promise<{ success: boolean; user: string; id?: number | string | null }> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!this.apiKey) {
      return { success: true, user: cleanUser }
    }

    const id = await this.getUserId(cleanUser)
    return { success: true, user: cleanUser, id }
  }

  static async createPreAuthKey(username: string, reusable = true): Promise<string> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!this.apiKey) {
      console.warn('[HeadscaleService] HEADSCALE_API_KEY não definida no ambiente. Usando fallback.')
      return `hskey-metrics-${cleanUser}-preauth`
    }

    try {
      // No Headscale gRPC protobuf v1, o campo 'user' é uint64 (ID numérico do usuário)
      let userId = await this.getUserId(cleanUser)
      if (userId === null) {
        // Fallback para 1 ou tenta novamente
        userId = 1
      }

      const response = await axios.post(
        `${this.baseUrl}/api/v1/preauthkey`,
        {
          user: userId,
          reusable,
          ephemeral: false,
          expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { headers: this.getHeaders(), timeout: 5000 }
      )

      const key = response.data?.preAuthKey?.key || response.data?.key || `hskey-metrics-${cleanUser}-preauth`
      HeadscaleService.lastError = null
      return key
    } catch (error: any) {
      const errMsg = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
      HeadscaleService.lastError = errMsg;
      console.warn(`[HeadscaleService] Falha ao gerar chave via API: ${errMsg}. Usando fallback.`);
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
