import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getIfoodCredentials, saveIfoodCredentials } from '@/lib/tenant-manager'

const schema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
})

function checkApiKey(request: FastifyRequest): boolean {
  const apiKey = request.headers['x-api-key']
  return apiKey === (process.env.API_KEY_PONTO || 'metrics_secret_key_2026')
}

/**
 * Credencial GLOBAL do app do iFood (vale para o sistema inteiro, não por tenant): fica salva na
 * tabela SaaSIntegrationConfig e tem prioridade sobre IFOOD_CLIENT_ID/IFOOD_CLIENT_SECRET do
 * ambiente. Nunca devolve o clientSecret de volta — só se está configurado e um pedaço do clientId,
 * pra confirmar visualmente que a troca funcionou sem expor o segredo.
 */
export async function getIfoodCredentialsStatusController(request: FastifyRequest, reply: FastifyReply) {
  if (!checkApiKey(request)) {
    return reply.status(401).send({ message: 'Acesso não autorizado' })
  }

  try {
    const credentials = await getIfoodCredentials()
    return reply.status(200).send({
      configured: Boolean(credentials),
      clientIdMasked: credentials ? `${credentials.clientId.slice(0, 8)}...` : null,
    })
  } catch (error: any) {
    console.error('[SaaS iFood Credentials] status', error)
    return reply.status(500).send({ message: 'Não foi possível consultar as credenciais iFood.' })
  }
}

export async function saveIfoodCredentialsController(request: FastifyRequest, reply: FastifyReply) {
  if (!checkApiKey(request)) {
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
    console.error('[SaaS iFood Credentials] save', error)
    return reply.status(500).send({ message: error?.message || 'Não foi possível salvar as credenciais iFood.' })
  }
}
