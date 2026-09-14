import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { saveIfoodCredentials } from '@/lib/tenant-manager'

const schema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
})

export async function saveIfoodCredentialsController(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key']
  if (apiKey !== (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')) {
    return reply.status(401).send({ message: 'Acesso não autorizado' })
  }

  try {
    const { clientId, clientSecret } = schema.parse(request.body)
    await saveIfoodCredentials(clientId, clientSecret)
    return reply.status(200).send({ success: true, message: 'Credenciais iFood salvas com sucesso.' })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: 'clientId e clientSecret são obrigatórios.' })
    }
    console.error('[SaaS iFood Credentials]', error)
    return reply.status(500).send({ message: 'Não foi possível salvar as credenciais iFood.' })
  }
}
