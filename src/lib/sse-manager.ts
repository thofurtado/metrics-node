import { FastifyReply } from 'fastify'

interface SseConnection {
    reply: FastifyReply
    tenantDomain: string
    connectedAt: Date
}

class SseManager {
    private tenantConnections: Map<string, Set<SseConnection>> = new Map()
    private heartbeatTimer: NodeJS.Timeout | null = null

    constructor() {
        this.startHeartbeat()
    }

    private normalizeDomain(domain: string): string {
        return domain
            .split(':')[0]
            .replace(/^www\./, '')
            .replace(/^api\./, '')
            .toLowerCase()
            .trim()
    }

    public addConnection(tenantDomain: string, reply: FastifyReply): SseConnection {
        const key = this.normalizeDomain(tenantDomain)
        if (!this.tenantConnections.has(key)) {
            this.tenantConnections.set(key, new Set())
        }

        const conn: SseConnection = {
            reply,
            tenantDomain: key,
            connectedAt: new Date()
        }

        this.tenantConnections.get(key)!.add(conn)
        console.log(`[SSE] PDV conectado para o tenant: ${key} (Total conectados no tenant: ${this.tenantConnections.get(key)!.size})`)
        return conn
    }

    public removeConnection(conn: SseConnection): void {
        const key = conn.tenantDomain
        const set = this.tenantConnections.get(key)
        if (set) {
            set.delete(conn)
            console.log(`[SSE] PDV desconectado do tenant: ${key} (Restantes no tenant: ${set.size})`)
            if (set.size === 0) {
                this.tenantConnections.delete(key)
            }
        }
    }

    public notifyTenant(tenantDomain: string, eventName: string, data: any): boolean {
        const key = this.normalizeDomain(tenantDomain)
        const connections = this.tenantConnections.get(key)

        if (!connections || connections.size === 0) {
            console.log(`[SSE] Nenhum PDV conectado no momento para o tenant: ${key}`)
            return false
        }

        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
        let sentCount = 0

        for (const conn of connections) {
            try {
                conn.reply.raw.write(payload)
                sentCount++
            } catch (err) {
                console.error(`[SSE] Erro ao enviar evento para PDV do tenant ${key}:`, err)
            }
        }

        console.log(`[SSE] Evento '${eventName}' enviado com sucesso para ${sentCount} PDV(s) do tenant ${key}`)
        return sentCount > 0
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            for (const [tenantKey, connections] of this.tenantConnections.entries()) {
                for (const conn of Array.from(connections)) {
                    try {
                        conn.reply.raw.write(': ping\n\n')
                    } catch (err) {
                        this.removeConnection(conn)
                    }
                }
            }
        }, 25000) // 25 segundos
    }

    public getActiveConnectionsCount(): number {
        let total = 0
        for (const set of this.tenantConnections.values()) {
            total += set.size
        }
        return total
    }
}

export const sseManager = new SseManager()
