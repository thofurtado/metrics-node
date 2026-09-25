import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aliquotasParaOPdv, consultarNcm, converterResposta, dataIbpt, limparCacheIbpt, mascararToken, normalizarCnpj, normalizarNcm,
} from './ibpt'

// Resposta real da API do IBPT (25/09/2026, NCM 21069090, SP).
const RESPOSTA_REAL = {
  Codigo: '21069090', UF: 'SP', EX: 0, Descricao: 'Preparacoes alimenticias diversas', Nacional: 13.45, Estadual: 18.0,
  Importado: 28.04, Municipal: 0.0, Tipo: '0', VigenciaInicio: '20/09/2026', VigenciaFim: '31/10/2026', Chave: 'C44399',
  Versao: '26.2.B', Fonte: 'IBPT/empresometro.com.br', Valor: 0, ValorTributoNacional: 0, ValorTributoEstadual: 0,
  ValorTributoImportado: 0, ValorTributoMunicipal: 0,
}

function respostaHttp(status: number, corpo: unknown) {
  return new Response(corpo === null ? null : JSON.stringify(corpo), { status })
}

describe('regras de formato', () => {
  it('NCM e CNPJ só com números e no tamanho certo', () => {
    expect(normalizarNcm('2106.90.90')).toBe('21069090')
    expect(normalizarNcm('2106')).toBeNull()
    expect(normalizarCnpj('37.099.684/0001-30')).toBe('37099684000130')
    expect(normalizarCnpj('123')).toBeNull()
  })

  it('data do IBPT vira ano-mês-dia', () => {
    expect(dataIbpt('31/10/2026')).toBe('2026-10-31')
    expect(dataIbpt('')).toBeNull()
  })

  it('token nunca aparece inteiro', () => {
    expect(mascararToken('ABCDEFGHIJKLMNOP')).toBe('ABCD…MNOP')
    expect(mascararToken('')).toBe('')
  })

  it('resposta do IBPT vira a mesma linha do arquivo CSV (exceção 0 = sem exceção)', () => {
    expect(converterResposta(RESPOSTA_REAL)).toEqual({
      ncm: '21069090', ex: '', tipo: '0', descricao: 'Preparacoes alimenticias diversas',
      nacionalFederal: 13.45, importadoFederal: 28.04, estadual: 18, municipal: 0,
      vigenciaInicio: '2026-09-20', vigenciaFim: '2026-10-31', chave: 'C44399', versao: '26.2.B', fonte: 'IBPT/empresometro.com.br',
    })
    expect(converterResposta({ Codigo: 'x' })).toBeNull()
  })
})

describe('consulta à API', () => {
  beforeEach(() => limparCacheIbpt())

  it('NCM inexistente: 404 sem corpo', async () => {
    const f = vi.fn().mockResolvedValue(respostaHttp(404, null))
    expect(await consultarNcm('t', '37099684000130', 'SP', '99999999', f as any)).toEqual({ status: 'nao_encontrado' })
  })

  it('token de outro CNPJ: recusado com a mensagem do IBPT', async () => {
    const f = vi.fn().mockResolvedValue(respostaHttp(403, { Message: 'Token inválido ou expirado para este CNPJ.' }))
    expect(await consultarNcm('t', '37099684000130', 'SP', '21069090', f as any))
      .toEqual({ status: 'recusado', mensagem: 'Token inválido ou expirado para este CNPJ.' })
  })

  it('segunda consulta do mesmo NCM sai do cache', async () => {
    const f = vi.fn().mockImplementation(async () => respostaHttp(200, RESPOSTA_REAL))
    await consultarNcm('t', '37099684000130', 'SP', '21069090', f as any)
    await consultarNcm('t', '37099684000130', 'SP', '21069090', f as any)
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('alíquotas para o PDV', () => {
  beforeEach(() => limparCacheIbpt())
  const config = { ativo: true, token: 'tok', cnpj: '37099684000130' }

  it('sem integração ativa não consulta nada', async () => {
    const f = vi.fn()
    const r = await aliquotasParaOPdv({ ...config, ativo: false }, 'SP', ['21069090'], f as any)
    expect(r.configurado).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('separa encontrados e não encontrados, ignorando NCM inválido e repetido', async () => {
    const f = vi.fn().mockImplementation(async (url: string) =>
      url.includes('codigo=99999999') ? respostaHttp(404, null) : respostaHttp(200, { ...RESPOSTA_REAL, Codigo: new URL(url).searchParams.get('codigo') }))
    const r = await aliquotasParaOPdv(config, 'sp', ['21069090', '2106.90.90', '99999999', 'abc', '22021000'], f as any)
    expect(r.uf).toBe('SP')
    expect(r.linhas.map(l => l.ncm)).toEqual(['21069090', '22021000'])
    expect(r.naoEncontrados).toEqual(['99999999'])
    expect(r.falha).toBeNull()
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('token recusado para na primeira leva e avisa', async () => {
    const f = vi.fn().mockResolvedValue(respostaHttp(403, { Message: 'Token inválido ou expirado para este CNPJ.' }))
    const ncms = Array.from({ length: 20 }, (_, i) => String(21069000 + i))
    const r = await aliquotasParaOPdv(config, 'SP', ncms, f as any)
    expect(r.falha).toBe('Token inválido ou expirado para este CNPJ.')
    expect(f).toHaveBeenCalledTimes(4)
  })
})
