import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'

function isStrictlyOnline(lastSeenAt: Date | string | null | undefined, maxInactiveMinutes = 6): boolean {
  if (!lastSeenAt) return false
  const d = new Date(lastSeenAt)
  if (isNaN(d.getTime())) return false
  const diffMs = Date.now() - d.getTime()
  return diffMs > -120000 && diffMs < maxInactiveMinutes * 60 * 1000
}

export async function getVpnNetworks(request: FastifyRequest, reply: FastifyReply) {
  try {
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

    // 3. Buscar nós ao vivo do Headscale se houver API Key (com fallback seguro)
    let liveNodes: any[] = []
    try {
      liveNodes = await HeadscaleService.listNodes()
    } catch (headscaleErr: any) {
      console.warn('[VPN-NOC] Falha ao consultar Headscale ao vivo:', headscaleErr.message)
    }

    const result = {
      groups: groups.map((g) => {
        const allEquipments = g.clients.flatMap((c) =>
          c.equipments.map((e) => {
            const liveNode = liveNodes.find(
              (n) => n.name.toLowerCase() === (e.identification || '').toLowerCase()
            )
            const isOnline = isStrictlyOnline(e.last_seen_at) || Boolean(liveNode?.online)
            const vpnIp =
              liveNode?.ipAddresses?.[0] ||
              (e as any).vpn_ip ||
              (e.last_telemetry as any)?.network?.vpnIp ||
              (e.last_telemetry as any)?.vpnIp ||
              '100.64.x.y'

            return {
              id: e.id,
              identification: e.identification || (e.last_telemetry as any)?.osInfo?.hostname || 'Dispositivo',
              clientName: c.name,
              clientId: c.id,
              isOnline,
              lastSeenAt: e.last_seen_at,
              vpnIp,
              headscaleNodeId: liveNode?.id || null,
              telemetry: e.last_telemetry,
            }
          })
        )

        return {
          id: g.id,
          name: g.name,
          description: g.description,
          headscaleUser: g.headscale_user || `group_${g.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          vpnPreauthKey: g.vpn_preauth_key,
          totalClients: g.clients.length,
          totalDevices: allEquipments.length,
          onlineDevices: allEquipments.filter((d) => d.isOnline).length,
          devices: allEquipments,
        }
      }),
      standaloneClients: unassignedClients
        .filter((c) => c.equipments.length > 0)
        .map((c) => {
          const safeName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)
          const shortId = c.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()
          const headscaleUser = `client_${safeName}_${shortId}`

          const devices = c.equipments.map((e) => {
            const liveNode = liveNodes.find(
              (n) => n.name.toLowerCase() === (e.identification || '').toLowerCase()
            )
            const isOnline = isStrictlyOnline(e.last_seen_at) || Boolean(liveNode?.online)
            const vpnIp =
              liveNode?.ipAddresses?.[0] ||
              (e as any).vpn_ip ||
              (e.last_telemetry as any)?.network?.vpnIp ||
              (e.last_telemetry as any)?.vpnIp ||
              '100.64.x.y'

            return {
              id: e.id,
              identification: e.identification || (e.last_telemetry as any)?.osInfo?.hostname || 'Dispositivo',
              isOnline,
              lastSeenAt: e.last_seen_at,
              vpnIp,
              telemetry: e.last_telemetry,
            }
          })

          return {
            id: c.id,
            name: c.name,
            headscaleUser,
            totalDevices: devices.length,
            onlineDevices: devices.filter((d) => d.isOnline).length,
            devices,
          }
        }),
    }

    return reply.status(200).send(result)
  } catch (err: any) {
    console.error('[VPN-NOC] Erro fatal em getVpnNetworks:', err)
    return reply.status(500).send({
      message: 'Erro interno ao consultar redes VPN.',
      error: err.message,
    })
  }
}
