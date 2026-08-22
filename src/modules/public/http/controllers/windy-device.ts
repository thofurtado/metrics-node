import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'

export async function getClientsSummaryForWindy(request: FastifyRequest, reply: FastifyReply) {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      identification: true,
    },
    orderBy: { name: 'asc' },
  })

  const formatted = clients.map((c) => ({
    id: c.id,
    name: c.name,
    identification: c.identification || '',
    groupId: '',
    groupName: 'Sem Grupo',
  }))

  return reply.status(200).send({ clients: formatted })
}

export async function bindDeviceFromWindy(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    identification: z.string(), // Nome do computador ou ID gerado
    clientId: z.string().uuid().optional(),
    macAddress: z.string().optional(),
    vpnIp: z.string().optional(),
  })

  const { identification, clientId, macAddress, vpnIp } = bodySchema.parse(request.body)

  let equipment = await prisma.equipment.findFirst({ where: { identification } })
  let resolvedClientId = clientId
  if (!resolvedClientId && equipment) { resolvedClientId = equipment.client_id }
  if (!resolvedClientId) { return reply.status(400).send({ message: 'clientId obrigatório para o primeiro vínculo.' }) }

  const client = await prisma.client.findUnique({
    where: { id: resolvedClientId },
  })

  if (!client) {
    return reply.status(404).send({ message: 'Cliente não encontrado.' })
  }

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

  const headscaleUser = `client_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  await HeadscaleService.createOrGetUser(headscaleUser)
  const vpnAuthKey = await HeadscaleService.createPreAuthKey(headscaleUser, true)

  return reply.status(200).send({
    success: true,
    equipmentId: equipment.id,
    clientName: client.name,
    groupName: 'Rede Privada da Empresa',
    headscaleUser,
    vpnAuthKey,
    loginServer: 'https://vpn.metrics.dev.br',
  })
}
