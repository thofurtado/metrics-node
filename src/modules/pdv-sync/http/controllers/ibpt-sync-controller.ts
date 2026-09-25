import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { aliquotasParaOPdv } from '@/modules/system-config/services/ibpt'
import { lerConfigIbpt } from '@/modules/system-config/services/tenant-integrations'

// GET /api/pdv/sync/ibpt?uf=SP&ncms=21069090,22021000
// Devolve as alíquotas do IBPT dos NCMs pedidos, com o token do cliente (que nunca vai para o PDV).
// Sem integração ativa: { configurado: false } e o PDV continua com a tabela importada por arquivo.
export async function getIbptSync(request: FastifyRequest, reply: FastifyReply) {
  const { uf, ncms } = z.object({ uf: z.string().optional(), ncms: z.string().optional() }).parse(request.query)
  const lista = (ncms ?? '').split(',').map(n => n.trim()).filter(Boolean)
  const resultado = await aliquotasParaOPdv(await lerConfigIbpt(prisma), uf, lista)
  return reply.send(resultado)
}
