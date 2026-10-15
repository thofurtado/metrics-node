import { FastifyReply } from 'fastify'
import { requestContext } from '@fastify/request-context'

/**
 * Avisos ao vivo (SSE) para os PDVs e para o caixa da web.
 *
 * Cada conexão fica guardada pelo NOME DO BANCO da loja (db_x), que o gancho de toda requisição já descobriu
 * (requestContext 'tenant'), e cada aviso vai só para as conexões desse banco, por nome exato.
 *
 * Por que (08/10/2026, LGPD): antes as conexões eram guardadas pelo domínio, mas o iFood e a 99 só conhecem o banco da
 * loja. Para o pedido chegar, o código mandava o aviso para TODAS as lojas conectadas (broadcast), com nome, telefone,
 * CPF e endereço do cliente, mandava todo pedido do iFood e da 99 também para a loja de teste e casava a loja por
 * "contém" (db_loja casaria com db_loja2). Não existe mais envio para todas as lojas: quem não sabe o banco não avisa.
 */
interface SseConnection {
    reply: FastifyReply
    banco: string
    connectedAt: Date
    /** false = conexão sem a chave do PDV nem o login da loja (02:P1): recebe só o aviso, sem os dados do cliente. */
    completo: boolean
}

/**
 * O que uma conexão sem chave recebe (Fase 0 do Mergulho, 02:P1): só o código, o número e a situação do pedido. O caixa da
 * web usa o aviso só para buscar a lista de novo (com o login); nome, telefone, CPF, endereço e itens não saem.
 */
export function avisoSemDadosDoCliente(data: any): Record<string, unknown> {
    const resumo: Record<string, unknown> = {}
    if (!data || typeof data !== 'object') return resumo
    for (const campo of ['id', 'order_id', 'display_id', 'status', 'status_delivery', 'updated_at']) {
        if (data[campo] !== undefined) resumo[campo] = data[campo]
    }
    return resumo
}

/** O banco da loja da requisição atual, que o gancho de toda requisição pôs em requestContext 'tenant'. */
export function bancoDaRequisicao(): string {
    return String((requestContext as any).get('tenant') ?? '')
}

export function chaveDoBanco(banco: string | null | undefined): string {
    return String(banco ?? '').trim().toLowerCase()
}

class SseManager {
    private conexoesPorBanco: Map<string, Set<SseConnection>> = new Map()
    private heartbeatTimer: NodeJS.Timeout | null = null

    constructor() {
        this.startHeartbeat()
    }

    /** Guarda a conexão do PDV ou do caixa da web no banco da loja (o nome que o gancho pôs em requestContext 'tenant'). */
    public addConnection(banco: string, reply: FastifyReply, completo = true): SseConnection {
        const key = chaveDoBanco(banco)
        if (!this.conexoesPorBanco.has(key)) {
            this.conexoesPorBanco.set(key, new Set())
        }

        const conn: SseConnection = { reply, banco: key, connectedAt: new Date(), completo }
        this.conexoesPorBanco.get(key)!.add(conn)
        console.log(`[SSE] Conectado: ${key} (${this.conexoesPorBanco.get(key)!.size} conexão(ões) nessa loja)`)
        return conn
    }

    public removeConnection(conn: SseConnection): void {
        const set = this.conexoesPorBanco.get(conn.banco)
        if (set) {
            set.delete(conn)
            if (set.size === 0) {
                this.conexoesPorBanco.delete(conn.banco)
            }
        }
    }

    /** Manda o aviso só para as conexões do banco da loja, por nome exato. Devolve se alguma conexão recebeu. */
    public notifyTenant(banco: string, eventName: string, data: any): boolean {
        const key = chaveDoBanco(banco)
        const connections = key ? this.conexoesPorBanco.get(key) : undefined
        if (!connections || connections.size === 0) {
            return false
        }

        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
        let resumido: string | null = null
        let sentCount = 0
        for (const conn of Array.from(connections)) {
            try {
                if (!conn.completo && resumido === null) {
                    resumido = `event: ${eventName}\ndata: ${JSON.stringify(avisoSemDadosDoCliente(data))}\n\n`
                }
                conn.reply.raw.write(conn.completo ? payload : resumido!)
                sentCount++
            } catch (err) {
                console.error(`[SSE] Erro ao enviar '${eventName}' para ${key}:`, err)
                this.removeConnection(conn)
            }
        }
        return sentCount > 0
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            for (const connections of this.conexoesPorBanco.values()) {
                for (const conn of Array.from(connections)) {
                    try {
                        conn.reply.raw.write(': ping\n\n')
                    } catch (err) {
                        this.removeConnection(conn)
                    }
                }
            }
        }, 25000) // 25 segundos: o proxy derruba conexão parada
        this.heartbeatTimer.unref?.()
    }

    public getActiveConnectionsCount(): number {
        let total = 0
        for (const set of this.conexoesPorBanco.values()) {
            total += set.size
        }
        return total
    }
}

export const sseManager = new SseManager()
