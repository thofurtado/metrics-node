import { FastifyReply, FastifyRequest } from 'fastify'

// Trava de papel (ADMIN). Fase 0 do Mergulho (achados 17:U7, 18:S9, 19:V5):
// ANTES, a chave x-api-key (a mesma que está escrita no app de Ponto) passava por esta trava sem conferir
// o papel — então quem tivesse a chave virava administrador, lia a VPN e mexia em usuários. A chave serve
// para o Ponto e o PDV sincronizarem (rotas que NÃO exigem ADMIN); nenhuma rota de administrador é chamada
// por app. Por isso a trava de ADMIN agora exige um usuário logado com papel ADMIN de verdade (JWT).
export function verifyUserRole(roleToVerify: 'ADMIN' | 'MEMBER') {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
            return reply.status(401).send({ message: 'Não autenticado' })
        }
        const { role } = request.user
        if (role !== roleToVerify) {
            return reply.status(403).send({ message: 'Acesso negado: permissão insuficiente' })
        }
    }
}
