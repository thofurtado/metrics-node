import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'

export async function listClientGroups(request: FastifyRequest, reply: FastifyReply) {
  const groups = await prisma.clientGroup.findMany({
    include: {
      clients: {
        include: {
          equipments: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return reply.status(200).send({ groups })
}

export async function createClientGroup(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    client_ids: z.array(z.string()).optional(),
  })

  const { name, description, client_ids } = bodySchema.parse(request.body)

  const headscaleUser = `group_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  await HeadscaleService.createOrGetUser(headscaleUser)
  const vpnPreauthKey = await HeadscaleService.createPreAuthKey(headscaleUser, true)

  const group = await prisma.clientGroup.create({
    data: {
      name,
      description,
      headscale_user: headscaleUser,
      vpn_preauth_key: vpnPreauthKey,
      ...(client_ids && client_ids.length > 0
        ? {
            clients: {
              connect: client_ids.map((id) => ({ id })),
            },
          }
        : {}),
    },
    include: {
      clients: true,
    },
  })

  return reply.status(201).send({ group })
}

export async function updateClientGroup(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({ id: z.string().uuid() })
  const bodySchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    client_ids: z.array(z.string()).optional(),
  })

  const { id } = paramsSchema.parse(request.params)
  const { name, description, client_ids } = bodySchema.parse(request.body)

  const group = await prisma.clientGroup.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(client_ids
        ? {
            clients: {
              set: client_ids.map((cid) => ({ id: cid })),
            },
          }
        : {}),
    },
    include: {
      clients: true,
    },
  })

  return reply.status(200).send({ group })
}

export async function deleteClientGroup(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({ id: z.string().uuid() })
  const { id } = paramsSchema.parse(request.params)

  // Desvincular clientes antes de deletar
  await prisma.client.updateMany({
    where: { group_id: id },
    data: { group_id: null },
  })

  await prisma.clientGroup.delete({
    where: { id },
  })

  return reply.status(204).send()
}
