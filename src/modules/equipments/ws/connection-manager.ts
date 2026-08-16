import { SocketStream } from '@fastify/websocket'

class ConnectionManager {
    private connections = new Map<string, SocketStream>()

    addConnection(equipmentId: string, connection: SocketStream) {
        this.connections.set(equipmentId, connection)
        console.log(\[WS] Equipment \ connected. Total: \\)
    }

    removeConnection(equipmentId: string) {
        this.connections.delete(equipmentId)
        console.log(\[WS] Equipment \ disconnected. Total: \\)
    }

    sendCommand(equipmentId: string, command: string) {
        const conn = this.connections.get(equipmentId)
        if (conn) {
            conn.socket.send(JSON.stringify({ action: command }))
            return true
        }
        return false
    }
}

export const connectionManager = new ConnectionManager()

