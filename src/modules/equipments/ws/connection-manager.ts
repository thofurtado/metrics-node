import { WebSocket } from 'ws'

class ConnectionManager {
    private connections = new Map<string, WebSocket>()

    addConnection(equipmentId: string, connection: WebSocket) {
        this.connections.set(equipmentId, connection)
        console.log(`[WS] Equipment ${equipmentId} connected. Total: ${this.connections.size}`)
    }

    removeConnection(equipmentId: string) {
        this.connections.delete(equipmentId)
        console.log(`[WS] Equipment ${equipmentId} disconnected. Total: ${this.connections.size}`)
    }

    sendCommand(equipmentId: string, command: string) {
        const conn = this.connections.get(equipmentId)
        if (conn) {
            conn.send(JSON.stringify({ action: command }))
            return true
        }
        return false
    }
}

export const connectionManager = new ConnectionManager()
