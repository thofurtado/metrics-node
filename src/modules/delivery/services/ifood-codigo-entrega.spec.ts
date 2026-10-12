import { describe, expect, it } from 'vitest'
import { codigoDeEntregaValido, resultadoDoCodigoDeEntrega } from './ifood-codigo-entrega'

describe('código de entrega do iFood (12/10/2026)', () => {
  it('aceita só os dígitos, de 4 a 8', () => {
    expect(codigoDeEntregaValido('1234')).toBe('1234')
    expect(codigoDeEntregaValido(' 12 34 ')).toBe('1234')
    expect(codigoDeEntregaValido('123')).toBeNull()
    expect(codigoDeEntregaValido('')).toBeNull()
    expect(codigoDeEntregaValido(undefined)).toBeNull()
  })

  it('código errado: a resposta real do iFood (pedido #5706 da Katatau) vira "código errado"', () => {
    const r = resultadoDoCodigoDeEntrega(400, { errorType: 'NOT_FOUND', description: 'Confirmation code is invalid', code: '400' })
    expect(r.ok).toBe(false)
    expect(r.mensagem).toContain('código está errado')
  })

  it('200 com success true = aceito; 200 com success false = errado', () => {
    expect(resultadoDoCodigoDeEntrega(200, { success: true }).ok).toBe(true)
    expect(resultadoDoCodigoDeEntrega(204, null).ok).toBe(true)
    const errado = resultadoDoCodigoDeEntrega(200, { success: false })
    expect(errado.ok).toBe(false)
    expect(errado.mensagem).toContain('código está errado')
  })

  it('sem permissão ou pedido que não aceita mais código: frase própria', () => {
    expect(resultadoDoCodigoDeEntrega(403, { error: { message: 'User is forbidden to access this resource' } }).mensagem).toContain('Autorize a loja')
    expect(resultadoDoCodigoDeEntrega(404, {}).mensagem).toContain('concluído ou cancelado')
    expect(resultadoDoCodigoDeEntrega(502, {}).mensagem).toContain('502')
  })
})
