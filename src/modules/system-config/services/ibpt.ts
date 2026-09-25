// "De Olho no Imposto" (IBPT): valor aproximado dos tributos de cada NCM, exigido no cupom pela Lei 12.741/2012.
//
// O token é da EMPRESA cliente, amarrado ao CNPJ dela ("Token inválido ou expirado para este CNPJ", resposta do
// próprio IBPT). Fica no banco do cliente (tenant_integrations) e nunca sai do backend: o PDV pede as alíquotas só
// dos NCMs que usa e guarda só elas. Nada da tabela nacional é guardado aqui (decisão do Thomás, 24/09/2026).

export const IBPT_API = 'https://apidoni.ibpt.org.br/api/v1/produtos'
// NCM usado para testar o token ao salvar: "preparações alimentícias", comum em todo restaurante.
export const NCM_DE_TESTE = '21069090'

export type AliquotaIbpt = {
  ncm: string
  ex: string
  tipo: string
  descricao: string
  nacionalFederal: number
  importadoFederal: number
  estadual: number
  municipal: number
  vigenciaInicio: string | null
  vigenciaFim: string | null
  chave: string
  versao: string
  fonte: string
}

export type ResultadoConsulta =
  | { status: 'ok'; aliquota: AliquotaIbpt }
  | { status: 'nao_encontrado' }
  | { status: 'recusado'; mensagem: string }
  | { status: 'erro'; mensagem: string }

export function normalizarNcm(valor: unknown): string | null {
  const d = String(valor ?? '').replace(/\D/g, '')
  return d.length === 8 ? d : null
}

export function normalizarCnpj(valor: unknown): string | null {
  const d = String(valor ?? '').replace(/\D/g, '')
  return d.length === 14 ? d : null
}

export function normalizarUf(valor: unknown): string | null {
  const uf = String(valor ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(uf) ? uf : null
}

// "31/10/2026" -> "2026-10-31"
export function dataIbpt(valor: unknown): string | null {
  const m = String(valor ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export function mascararToken(token: string | null | undefined): string {
  if (!token) return ''
  return token.length > 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : '••••'
}

const numero = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// Resposta do IBPT -> linha no formato da tabela do PDV (mesmas colunas do arquivo CSV oficial).
export function converterResposta(json: any): AliquotaIbpt | null {
  const ncm = normalizarNcm(json?.Codigo)
  if (!ncm) return null
  const ex = json?.EX === null || json?.EX === undefined || Number(json.EX) === 0 ? '' : String(json.EX)
  return {
    ncm,
    ex,
    tipo: String(json?.Tipo ?? '0'),
    descricao: String(json?.Descricao ?? '').slice(0, 300),
    nacionalFederal: numero(json?.Nacional),
    importadoFederal: numero(json?.Importado),
    estadual: numero(json?.Estadual),
    municipal: numero(json?.Municipal),
    vigenciaInicio: dataIbpt(json?.VigenciaInicio),
    vigenciaFim: dataIbpt(json?.VigenciaFim),
    chave: String(json?.Chave ?? '').slice(0, 30),
    versao: String(json?.Versao ?? '').slice(0, 20),
    fonte: String(json?.Fonte ?? 'IBPT'),
  }
}

// Cache em memória por CNPJ + UF + NCM até o fim da vigência (no máximo 7 dias): o PDV de cada caixa pergunta
// os mesmos NCMs, e a tabela do IBPT só muda a cada ~40 dias.
const cache = new Map<string, { aliquota: AliquotaIbpt; expira: number }>()
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

function validadeDoCache(a: AliquotaIbpt, agora: number) {
  const fim = a.vigenciaFim ? Date.parse(`${a.vigenciaFim}T23:59:59-03:00`) : NaN
  return Math.min(Number.isFinite(fim) ? fim : agora + SETE_DIAS, agora + SETE_DIAS)
}

export async function consultarNcm(
  token: string,
  cnpj: string,
  uf: string,
  ncm: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoConsulta> {
  const chaveCache = `${cnpj}|${uf}|${ncm}`
  const agora = Date.now()
  const guardado = cache.get(chaveCache)
  if (guardado && guardado.expira > agora) return { status: 'ok', aliquota: guardado.aliquota }

  const parametros = new URLSearchParams({
    token, cnpj, codigo: ncm, uf, ex: '0', descricao: 'Produto', unidadeMedida: 'UN', valor: '0', gtin: 'SEM GTIN',
  })
  try {
    const resposta = await fetchImpl(`${IBPT_API}?${parametros}`, { signal: AbortSignal.timeout(15000) })
    if (resposta.status === 404) return { status: 'nao_encontrado' }
    const texto = await resposta.text()
    let json: any = null
    try { json = texto ? JSON.parse(texto) : null } catch { /* resposta sem JSON */ }
    if (resposta.ok) {
      const aliquota = converterResposta(json)
      if (!aliquota) return { status: 'erro', mensagem: 'O IBPT respondeu num formato inesperado.' }
      cache.set(chaveCache, { aliquota, expira: validadeDoCache(aliquota, agora) })
      return { status: 'ok', aliquota }
    }
    const mensagem = String(json?.Message || `O IBPT respondeu ${resposta.status}.`)
    return resposta.status >= 400 && resposta.status < 500 ? { status: 'recusado', mensagem } : { status: 'erro', mensagem }
  } catch (err: any) {
    return { status: 'erro', mensagem: `Não foi possível falar com o IBPT: ${err?.name === 'TimeoutError' ? 'demorou demais' : err?.message || err}` }
  }
}

export function limparCacheIbpt() {
  cache.clear()
}

export type ConfigIbpt = { ativo: boolean; token: string | null; cnpj: string | null }

export type AliquotasParaOPdv = {
  configurado: boolean
  uf: string | null
  linhas: AliquotaIbpt[]
  naoEncontrados: string[]
  falha: string | null
}

// Busca as alíquotas dos NCMs que o PDV pediu. Token recusado interrompe na hora (não martela o IBPT).
export async function aliquotasParaOPdv(
  config: ConfigIbpt | null,
  ufPedida: unknown,
  ncmsPedidos: unknown[],
  fetchImpl: typeof fetch = fetch,
): Promise<AliquotasParaOPdv> {
  const uf = normalizarUf(ufPedida)
  if (!config?.ativo || !config.token || !config.cnpj) {
    return { configurado: false, uf, linhas: [], naoEncontrados: [], falha: null }
  }
  if (!uf) return { configurado: true, uf: null, linhas: [], naoEncontrados: [], falha: 'UF do emitente inválida.' }

  const ncms = [...new Set(ncmsPedidos.map(normalizarNcm).filter((n): n is string => Boolean(n)))].slice(0, 300)
  const linhas: AliquotaIbpt[] = []
  const naoEncontrados: string[] = []
  let falha: string | null = null

  for (let i = 0; i < ncms.length && !falha; i += 4) {
    const lote = ncms.slice(i, i + 4)
    const respostas = await Promise.all(lote.map(ncm => consultarNcm(config.token!, config.cnpj!, uf, ncm, fetchImpl)))
    respostas.forEach((r, j) => {
      if (r.status === 'ok') linhas.push(r.aliquota)
      else if (r.status === 'nao_encontrado') naoEncontrados.push(lote[j])
      else falha = falha ?? r.mensagem
    })
  }
  return { configurado: true, uf, linhas, naoEncontrados, falha }
}
