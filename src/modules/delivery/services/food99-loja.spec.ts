import { describe, expect, it } from 'vitest'
import { appShopIdPadrao, decidirEnvioDoCardapio, urlDaAutorizacao } from './food99-loja'

describe('loja na 99Food (12/10/2026)', () => {
  it('App Shop ID padrão sai do nome do banco da loja', () => {
    expect(appShopIdPadrao('db_katatau')).toBe('metrics-katatau')
    expect(appShopIdPadrao('')).toBe('')
  })

  it('cardápio da Katatau já montado na 99: o envio é recusado', () => {
    const d = decidirEnvioDoCardapio({ ok: true, items: [{}, {}, {}] })
    expect(d.pode).toBe(false)
    expect(d.motivo).toContain('já tem 3 itens')
  })

  it('sem resposta da 99: também recusa (nunca envia no escuro)', () => {
    expect(decidirEnvioDoCardapio({ ok: false, errmsg: 'Sem token da 99Food', items: [] }).pode).toBe(false)
  })

  it('loja nova (nenhum item na 99): pode enviar', () => {
    expect(decidirEnvioDoCardapio({ ok: true, items: [] }).pode).toBe(true)
  })

  it('endereço de autorização: o formato real é objeto com url (e aceita texto e lista)', () => {
    expect(urlDaAutorizacao({ errno: 0, data: { url: 'https://merchant.99app.com/x?sign=1' } })).toBe('https://merchant.99app.com/x?sign=1')
    expect(urlDaAutorizacao({ data: 'https://merchant.99app.com/y' })).toBe('https://merchant.99app.com/y')
    expect(urlDaAutorizacao({ data: ['https://merchant.99app.com/z'] })).toBe('https://merchant.99app.com/z')
    expect(urlDaAutorizacao({ errno: 10001, data: null })).toBeNull()
    expect(urlDaAutorizacao({ data: { url: 'javascript:alert(1)' } })).toBeNull()
  })
})
