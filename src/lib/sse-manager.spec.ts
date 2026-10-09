import { describe, it, expect, vi } from 'vitest'
import { sseManager, chaveDoBanco } from './sse-manager'

// Caso de 08/10/2026 (LGPD): o pedido do iFood de uma loja, com nome, telefone, CPF e endereço do cliente, ia para as
// conexões de TODAS as lojas. Agora cada conexão é guardada pelo banco da loja e o aviso vai só para esse banco.
function conexaoFalsa() {
  const recebidos: string[] = []
  const reply: any = { raw: { write: vi.fn((texto: string) => { recebidos.push(texto) }) } }
  return { reply, recebidos }
}

describe('Avisos ao vivo: cada loja só recebe os próprios pedidos', () => {
  it('o aviso vai só para o banco da loja do pedido', () => {
    const marujo = conexaoFalsa()
    const outra = conexaoFalsa()
    const c1 = sseManager.addConnection('db_marujo', marujo.reply)
    const c2 = sseManager.addConnection('db_outra', outra.reply)

    expect(sseManager.notifyTenant('db_marujo', 'new_order', { client_name: 'Cliente', client_phone: '11999990000' })).toBe(true)
    expect(marujo.recebidos.join('')).toContain('event: new_order')
    expect(outra.recebidos).toHaveLength(0)

    sseManager.removeConnection(c1)
    sseManager.removeConnection(c2)
  })

  it('não casa loja por "contém": db_loja não recebe o aviso de db_loja2', () => {
    const loja = conexaoFalsa()
    const c = sseManager.addConnection('db_loja', loja.reply)

    expect(sseManager.notifyTenant('db_loja2', 'new_order', {})).toBe(false)
    expect(sseManager.notifyTenant('loja', 'new_order', {})).toBe(false)
    expect(loja.recebidos).toHaveLength(0)

    sseManager.removeConnection(c)
  })

  it('sem o banco da loja, ninguém recebe', () => {
    const loja = conexaoFalsa()
    const c = sseManager.addConnection('db_loja', loja.reply)

    expect(sseManager.notifyTenant('', 'new_order', {})).toBe(false)
    expect(sseManager.notifyTenant(undefined as any, 'new_order', {})).toBe(false)
    expect(loja.recebidos).toHaveLength(0)

    sseManager.removeConnection(c)
  })

  it('não existe mais envio para todas as lojas', () => {
    expect((sseManager as any).broadcast).toBeUndefined()
  })

  it('o nome do banco ignora maiúsculas e espaços', () => {
    expect(chaveDoBanco(' DB_Marujo ')).toBe('db_marujo')
  })

  it('conexão que deu erro sai da lista', () => {
    const quebrada: any = { raw: { write: vi.fn(() => { throw new Error('conexão fechada') }) } }
    sseManager.addConnection('db_quebrada', quebrada)
    const antes = sseManager.getActiveConnectionsCount()
    expect(sseManager.notifyTenant('db_quebrada', 'new_order', {})).toBe(false)
    expect(sseManager.getActiveConnectionsCount()).toBe(antes - 1)
  })
})
