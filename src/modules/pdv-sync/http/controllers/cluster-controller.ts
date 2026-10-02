import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { juizDaTroca } from '../../services/cluster-judge'

/**
 * POST /api/pdv/cluster/vivo — "estou vivo" de um computador da ordem dos servidores (troca automática do PDV, 02/10/2026).
 * Responde há quantos segundos a nuvem não ouve cada computador da mesma loja e o maior mandato que ela conhece.
 * Mesma chave do PDV (x-api-key) e loja pelo x-tenant-domain, como as outras rotas de sincronia.
 */
export async function postClusterVivo(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
        terminalId: z.string().min(1).max(40),
        nome: z.string().max(120).optional().default(''),
        situacao: z.string().max(20).optional().default(''),
        mandato: z.number().int().min(0).optional().default(0),
    })
    const corpo = schema.safeParse(request.body)
    if (!corpo.success) return reply.status(400).send({ message: 'Dados do computador inválidos.' })

    const loja = (request.headers['x-tenant-domain'] as string | undefined)?.trim()
    if (!loja) return reply.status(400).send({ message: 'Loja não informada (x-tenant-domain).' })

    return reply.send(juizDaTroca.avisarVivo(loja, corpo.data))
}
