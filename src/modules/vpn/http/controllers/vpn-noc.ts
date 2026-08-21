import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'

export async function getVpnNetworks(request: FastifyRequest, reply: FastifyReply) {
  // 1. Buscar grupos com clientes e equipamentos
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

  // 2. Buscar clientes sem grupo que possuam equipamentos
  const unassignedClients = await prisma.client.findMany({
    where: { group_id: null },
    include: {
      equipments: true,
    },
    orderBy: { name: 'asc' },
  })

  // 3. Buscar nós ao vivo do Headscale se houver API Key
  const liveNodes = await HeadscaleService.listNodes()

  const result = {
    groups: groups.map((g) => {
      const allEquipments = g.clients.flatMap((c) =>
        c.equipments.map((e) => {
          const liveNode = liveNodes.find(
            (n) => n.name.toLowerCase() === (e.identification || '').toLowerCase()
          )
          return {
            id: e.id,
            identification: e.identification,
            clientName: c.name,
            clientId: c.id,
            isOnline: Boolean(e.is_online),
            lastSeenAt: e.last_seen_at,
            vpnIp: liveNode?.ipAddresses?.[0] || e.vpn_ip || '100.64.x.y',
            headscaleNodeId: liveNode?.id || null,
            telemetry: e.last_telemetry,
          }
        })
      )

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        headscaleUser: g.headscale_user,
        vpnPreauthKey: g.vpn_preauth_key,
        totalClients: g.clients.length,
        totalDevices: allEquipments.length,
        onlineDevices: allEquipments.filter((d) => d.isOnline).length,
        devices: allEquipments,
      }
    }),
    standaloneClients: unassignedClients
      .filter((c) => c.equipments.length > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        totalDevices: c.equipments.length,
        onlineDevices: c.equipments.filter((e) => e.is_online).length,
        devices: c.equipments.map((e) => ({
          id: e.id,
          identification: e.identification,
          isOnline: Boolean(e.is_online),
          lastSeenAt: e.last_seen_at,
          vpnIp: e.vpn_ip || '100.64.x.y',
          telemetry: e.last_telemetry,
        })),
      })),
  }

  return reply.status(200).send(result)
}
