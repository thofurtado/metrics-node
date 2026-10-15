import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'

// Trava de MÓDULO nas rotas. Fase 0 do Mergulho (17:U1, padrão P2, item 0.3 do plano):
// ANTES, a proteção dos módulos existia só na web (ModuleGuard); a nuvem conferia apenas se o token era válido, então
// um usuário liberado só para o Caixa lia GET /transactions ou GET /hr/employees com o próprio token.
//
// A regra é a MESMA da web (metrics/src/context/module-context.tsx, hasAccess), para a nuvem não barrar o que a tela
// mostra:
//   - ADMIN passa em tudo;
//   - CASHIER só passa nas rotas que aceitam o Caixa ('cashier');
//   - os outros papéis precisam ter um dos módulos aceitos em user_modules.
// Os módulos e o papel vêm do BANCO (como o /me da web), não do token: o token guarda o NOME do módulo
// ("Financeiro"), não o slug, e fica até 7 dias sem renovar.
// Não confere se o módulo está ligado na loja (system_config): a web esconde a tela, mas o app Gerencial abre o painel
// mesmo com o Atendimento desligado e deslogaria o dono.
//
// Chamada SEM usuário (chave x-api-key aceita pelo verifyJwt) segue como antes: nenhum app instalado chama estas rotas
// com a chave (Ponto, Windy e PDV usam os grupos próprios), e a troca da chave fixa é o item 0.6 do plano.

export type ModuleSlug = 'finance' | 'hr' | 'service' | 'items' | 'stock' | 'cashier' | 'settings'

export function canUseModule(role: string | null | undefined, userSlugs: string[], accepted: string[]): boolean {
    if (role === 'ADMIN') return true
    if (role === 'CASHIER') return accepted.includes('cashier')
    return userSlugs.some(slug => accepted.includes(slug))
}

const NOMES: Record<string, string> = {
    finance: 'Financeiro',
    hr: 'RH',
    service: 'Atendimento',
    items: 'Itens',
    stock: 'Controle de Estoque',
    cashier: 'Caixa',
    settings: 'Configurações',
}

export function verifyModuleAccess(...accepted: ModuleSlug[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const sub = (request.user as { sub?: string } | undefined)?.sub
        if (!sub) return // chave x-api-key (sem usuário): ver o comentário acima

        const user = await prisma.user.findUnique({
            where: { id: sub },
            select: { role: true, userModules: { select: { module: { select: { slug: true } } } } },
        })
        if (!user) {
            return reply.status(401).send({ message: 'Usuário não encontrado. Entre de novo.' })
        }

        const slugs = user.userModules.map(um => um.module.slug)
        if (!canUseModule(user.role, slugs, accepted)) {
            const nomes = accepted.map(s => NOMES[s] || s).join(' ou ')
            return reply.status(403).send({
                message: `Acesso negado: seu usuário não tem o módulo ${nomes}.`,
                code: 'MODULE_FORBIDDEN',
                modules: accepted,
            })
        }
    }
}

/**
 * Trava das 3 rotas que a tela inicial do app Gerencial (metrics-mobile 2.0.4) chama logo ao abrir: /summary,
 * /dashboard/operacional e /service-management. O app instalado trata QUALQUER 403 nelas como sessão encerrada
 * (HeaderStats.kt apaga o token e volta ao login), então um técnico sem Financeiro ou sem Atendimento entraria e
 * sairia sem parar. Por isso a trava nelas só liga com a variável TRAVA_MODULO_PAINEL=1, depois que o Gerencial
 * novo (que mostra "sem permissão" sem deslogar) estiver nos celulares. Hoje as 3 lojas não têm técnico: só ADMIN
 * (que passa sempre) e CASHIER (que não entra no Gerencial).
 */
export function verifyModuleAccessPainel(...accepted: ModuleSlug[]) {
    const trava = verifyModuleAccess(...accepted)
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (process.env.TRAVA_MODULO_PAINEL !== '1') return
        return trava(request, reply)
    }
}
