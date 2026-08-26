import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { HeadscaleService } from '@/modules/vpn/services/headscale-service'
import { Pool } from 'pg'

const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public"

export async function getClientsSummaryForWindy(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Tentar buscar clientes locais no prisma
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        document: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    if (clients.length > 0) {
      const formatted = clients.map((c) => ({
        id: c.id,
        name: c.name,
        identification: c.document || '',
        groupId: '',
        groupName: 'Empresa',
      }))
      return reply.status(200).send({
      success: true,
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      groupName: `Rede Privada (${resolvedClientName})`,
      headscaleUser,
      vpnAuthKey,
      loginServer: 'https://vpn.metrics.dev.br',
      debug: {
        hasApiKey: Boolean(process.env.HEADSCALE_API_KEY),
        apiKeyLength: (process.env.HEADSCALE_API_KEY || '').length,
        apiKeyStart: (process.env.HEADSCALE_API_KEY || '').substring(0, 12),
        headscaleUrl: process.env.HEADSCALE_URL || 'https://vpn.metrics.dev.br',
        headscaleLastError: HeadscaleService.lastError,
      }
    })
  } catch (error: any) {
    console.error('[Windy] Erro ao vincular dispositivo:', error)
    return reply.status(500).send({ message: 'Erro ao vincular empresa.', error: error.message })
  }
}
