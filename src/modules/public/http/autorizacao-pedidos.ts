import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { getDbNameForDomain } from '@/lib/tenant-manager'
import { chaveDoPdvValida } from '@/modules/pdv-sync/http/controllers/routes'

/**
 * Quem pode mexer nos pedidos de uma loja (Fase 0 do Mergulho, 02:P1, 15/10/2026).
 *
 * Antes a lista do dia, a mudança de situação, o canal ao vivo e o envio de pedidos só pediam o domínio da loja (o mesmo do
 * cardápio): qualquer um cancelava pedido no iFood/99, marcava como entregue, lançava dinheiro num caixa e via nome,
 * telefone e endereço dos clientes (LGPD).
 *
 * Agora vale a chave do PDV (x-api-key) ou o login da própria loja (o caixa da web manda o login em toda chamada).
 * O cardápio continua sem chave só onde precisa: criar o pedido (POST /public/orders), acompanhar a situação dele
 * (GET /public/orders/:id/status) e o aviso no celular.
 *
 * Em dois passos, para não parar as lojas: o PDV 2.5.53.0 não manda a chave nas rotas de pedidos.
 *  1) Hoje: as rotas que só a web usa já exigem o login; as do PDV (/api/pdv/orders...) e o canal ao vivo aceitam sem
 *     chave, com aviso no registro da nuvem. O PDV novo passa a mandar a chave.
 *  2) Quando todas as lojas estiverem no PDV novo: PEDIDOS_EXIGIR_CHAVE=true (variável no Coolify, sem novo deploy) fecha.
 */

export type QuemPede = 'pdv' | 'login' | null

function tokenDoCabecalho(request: FastifyRequest): string | null {
    const auth = request.headers.authorization
    return typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.substring(7).trim() || null : null
}

/** O login é da MESMA loja da chamada? Login de outra loja não abre os pedidos desta. Login antigo, sem a loja, vale. */
async function loginDaLoja(dominioDoLogin: unknown): Promise<boolean> {
    if (typeof dominioDoLogin !== 'string' || !dominioDoLogin.trim()) return true
    const bancoDaChamada = String((requestContext as any).get('tenant') ?? '')
    if (!bancoDaChamada) return false
    const dominio = dominioDoLogin.split(',')[0].trim().split(':')[0].replace(/^www\./, '').replace(/^api\./, '')
    const bancoDoLogin = await getDbNameForDomain(dominio)
    return !!bancoDoLogin && bancoDoLogin === bancoDaChamada
}

/** 'pdv' (chave do PDV), 'login' (login da própria loja) ou null (ninguém conhecido). */
export async function quemPede(request: FastifyRequest): Promise<QuemPede> {
    if (chaveDoPdvValida(request.headers['x-api-key'])) return 'pdv'
    if (!tokenDoCabecalho(request) && !(request as any).cookies?.refreshToken) return null
    try {
        const conteudo: any = await (request as any).jwtVerify()
        return (await loginDaLoja(conteudo?.tenantDomain)) ? 'login' : null
    } catch {
        return null
    }
}

/** A trava foi ligada (passo 2)? */
export function pedidosExigemChave(): boolean {
    return String(process.env.PEDIDOS_EXIGIR_CHAVE || '').trim().toLowerCase() === 'true'
}

const ultimoAviso = new Map<string, number>()

/** Chamada sem chave aceita no passo 1: um aviso por rota e por loja a cada 10 min (o PDV chama a cada 5 s). */
function avisarSemChave(rota: string) {
    const chave = `${(requestContext as any).get('tenant') ?? '?'}|${rota}`
    const agora = Date.now()
    if (agora - (ultimoAviso.get(chave) ?? 0) < 10 * 60 * 1000) return
    ultimoAviso.set(chave, agora)
    console.warn(`[Pedidos] ${rota} chamada SEM a chave do PDV (loja ${(requestContext as any).get('tenant') ?? '?'}): aceita só até PEDIDOS_EXIGIR_CHAVE=true.`)
}

const MENSAGEM_SEM_CHAVE = 'Acesso negado: os pedidos da loja pedem a chave do PDV ou o login da loja.'

/** Rotas que só a web usa (ela sempre manda o login): fechadas desde já. */
export async function exigirChaveOuLogin(request: FastifyRequest, reply: FastifyReply) {
    if (await quemPede(request)) return
    return reply.status(401).send({ message: MENSAGEM_SEM_CHAVE })
}

/** Rotas do PDV: sem chave, aceitas com aviso até a trava ser ligada (passo 2). */
export async function chaveOuLoginNaTransicao(request: FastifyRequest, reply: FastifyReply) {
    if (await quemPede(request)) return
    if (pedidosExigemChave()) return reply.status(401).send({ message: MENSAGEM_SEM_CHAVE })
    ;(request as any).pedidoSemChave = true
    avisarSemChave(request.routeOptions?.url ?? request.url.split('?')[0])
}

/** A chamada entrou sem chave nem login (passo 1)? Aí ela não lança dinheiro em caixa (o PDV nunca manda o caixa). */
export function entrouSemChave(request: FastifyRequest): boolean {
    return (request as any).pedidoSemChave === true
}
