import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '../../vpn/services/headscale-service'

export async function getClientsSummaryForWindy(request: FastifyRequest, reply: FastifyReply) {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      identification: true,
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const formatted = clients.map((c) => ({
    id: c.id,
    name: c.name,
    identification: c.identification || '',
    groupId: c.group?.id || null,
    groupName: c.group?.name || null,
  }))

  return reply.status(200).send({ clients: formatted })
}

export async function bindDeviceFromWindy(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    identification: z.string(), // Nome do computador ou ID gerado
    clientId: z.string().uuid(),
    macAddress: z.string().optional(),
    vpnIp: z.string().optional(),
  })

  const { identification, clientId, macAddress, vpnIp } = bodySchema.parse(request.body)

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { group: true },
  })

  if (!client) {
    return reply.status(404).send({ message: 'Cliente não encontrado.' })
  }

  // Buscar se o equipamento já existe pelo identification ou criar
  let equipment = await prisma.equipment.findFirst({
    where: { identification },
  })

  if (equipment) {
    equipment = await prisma.equipment.update({
      where: { id: equipment.id },
      data: {
        client_id: client.id,
        is_online: true,
        last_seen_at: new Date(),
        ...(vpnIp ? { vpn_ip: vpnIp } : {}),
      },
    })
  } else {
    equipment = await prisma.equipment.create({
      data: {
        client_id: client.id,
        identification,
        type: 'Computador Windows',
        details: macAddress ? `MAC: ${macAddress}` : 'Agente Windy',
        is_online: true,
        last_seen_at: new Date(),
        ...(vpnIp ? { vpn_ip: vpnIp } : {}),
      },
    })
  }

  // Se o cliente tem grupo, obter a chave do grupo. Caso contrário, criar/obter do cliente
  let headscaleUser = client.group?.headscale_user
  let vpnAuthKey = client.group?.vpn_preauth_key

  if (!headscaleUser) {
    headscaleUser = `client_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    await HeadscaleService.createOrGetUser(headscaleUser)
    vpnAuthKey = await HeadscaleService.createPreAuthKey(headscaleUser, true)
  }

  return reply.status(200).send({
    success: true,
    equipmentId: equipment.id,
    clientName: client.name,
    groupName: client.group?.name || 'Rede Privada da Empresa',
    headscaleUser,
    vpnAuthKey,
    loginServer: 'https://vpn.metrics.dev.br',
  })
}
