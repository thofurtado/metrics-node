import { WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'

/** Resposta do Windy a um comando (Mergulho 08:W6). */
export interface ConfirmacaoDoComando {
    confirmado: boolean
    ok?: boolean
    detalhe?: string
}

class ConnectionManager {
    private connections = new Map<string, WebSocket>()
    // Comandos esperando a resposta do Windy, pelo commandId
    private pendentes = new Map<string, { equipmentId: string; resolver: (c: ConfirmacaoDoComando) => void; timer: NodeJS.Timeout }>()

    addConnection(equipmentId: string, connection: WebSocket) {
        this.connections.set(equipmentId, connection)
        console.log(`[WS] Equipment ${equipmentId} connected. Total: ${this.connections.size}`)
    }

    /**
     * Tira a conexão da lista. Mergulho (08:W6): só tira se for a MESMA conexão que fechou; antes o fechamento de uma
     * conexão velha apagava a nova do mesmo equipamento, e o comando seguinte dava "não está online".
     */
    removeConnection(equipmentId: string, connection?: WebSocket) {
        if (connection && this.connections.get(equipmentId) !== connection) return
        this.connections.delete(equipmentId)
        console.log(`[WS] Equipment ${equipmentId} disconnected. Total: ${this.connections.size}`)
    }

    /**
     * Manda o comando ao Windy. Devolve o commandId (ou false se o equipamento não está conectado).
     * Mergulho (08:W6): o comando leva um commandId; o Windy novo responde `command_ack` com o mesmo id. O Windy antigo
     * ignora o campo e continua funcionando como antes (sem resposta).
     */
    sendCommand(equipmentId: string, command: string): string | false {
        const conn = this.connections.get(equipmentId)
        if (conn) {
            const commandId = randomUUID()
            conn.send(JSON.stringify({ action: command, commandId }))
            return commandId
        }
        return false
    }

    /** Espera a resposta do Windy por até `esperaMs`; sem resposta (Windy antigo ou ocupado), `confirmado: false`. */
    aguardarConfirmacao(equipmentId: string, commandId: string, esperaMs = 5000): Promise<ConfirmacaoDoComando> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendentes.delete(commandId)
                resolve({ confirmado: false })
            }, esperaMs)
            this.pendentes.set(commandId, { equipmentId, resolver: resolve, timer })
        })
    }

    /** Mensagem que chegou do Windy pelo WebSocket. Hoje só a resposta de comando (`command_ack`) é usada. */
    receberMensagem(equipmentId: string, texto: string) {
        let msg: any
        try {
            msg = JSON.parse(texto)
        } catch {
            return
        }
        if (msg?.type !== 'command_ack' || typeof msg.commandId !== 'string') return
        const pendente = this.pendentes.get(msg.commandId)
        // Só vale a resposta do mesmo equipamento que recebeu o comando
        if (!pendente || pendente.equipmentId !== equipmentId) return
        clearTimeout(pendente.timer)
        this.pendentes.delete(msg.commandId)
        pendente.resolver({
            confirmado: true,
            ok: msg.ok !== false,
            detalhe: typeof msg.detail === 'string' ? msg.detail.slice(0, 300) : undefined,
        })
    }
}

export const connectionManager = new ConnectionManager()
