import { describe, expect, it, vi } from 'vitest'
import { connectionManager } from './connection-manager'

// Mergulho (08:W6): o comando leva um commandId e o Windy novo responde command_ack pelo mesmo WebSocket
function socketFalso() {
    return { send: vi.fn() } as any
}

describe('comando para o Windy com confirmação (Mergulho 08:W6)', () => {
    it('manda o commandId junto e resolve quando o Windy responde', async () => {
        const ws = socketFalso()
        connectionManager.addConnection('eq-1', ws)
        const id = connectionManager.sendCommand('eq-1', 'REFRESH_TELEMETRY')
        expect(typeof id).toBe('string')
        expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({ action: 'REFRESH_TELEMETRY', commandId: id })
        const espera = connectionManager.aguardarConfirmacao('eq-1', id as string, 1000)
        connectionManager.receberMensagem('eq-1', JSON.stringify({ type: 'command_ack', commandId: id, ok: false, detail: 'Token local ausente' }))
        await expect(espera).resolves.toEqual({ confirmado: true, ok: false, detalhe: 'Token local ausente' })
    })

    it('Windy antigo (sem resposta): termina sem confirmação no tempo combinado', async () => {
        vi.useFakeTimers()
        const ws = socketFalso()
        connectionManager.addConnection('eq-2', ws)
        const id = connectionManager.sendCommand('eq-2', 'ATUALIZAR_WINDY') as string
        const espera = connectionManager.aguardarConfirmacao('eq-2', id, 5000)
        vi.advanceTimersByTime(5001)
        await expect(espera).resolves.toEqual({ confirmado: false })
        vi.useRealTimers()
    })

    it('resposta de outro equipamento ou texto que não é JSON é ignorado', async () => {
        vi.useFakeTimers()
        connectionManager.addConnection('eq-3', socketFalso())
        const id = connectionManager.sendCommand('eq-3', 'X') as string
        const espera = connectionManager.aguardarConfirmacao('eq-3', id, 1000)
        connectionManager.receberMensagem('eq-outro', JSON.stringify({ type: 'command_ack', commandId: id, ok: true }))
        connectionManager.receberMensagem('eq-3', 'isto não é json')
        vi.advanceTimersByTime(1001)
        await expect(espera).resolves.toEqual({ confirmado: false })
        vi.useRealTimers()
    })

    it('fechar a conexão velha não derruba a nova do mesmo equipamento', () => {
        const velha = socketFalso()
        const nova = socketFalso()
        connectionManager.addConnection('eq-4', velha)
        connectionManager.addConnection('eq-4', nova)
        connectionManager.removeConnection('eq-4', velha)
        expect(connectionManager.sendCommand('eq-4', 'X')).not.toBe(false)
        connectionManager.removeConnection('eq-4', nova)
        expect(connectionManager.sendCommand('eq-4', 'X')).toBe(false)
    })
})
