
import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getModulesStatus(request: FastifyRequest, reply: FastifyReply) {
    // Tenta buscar a configuração existente (Singleton)
    const config = await prisma.systemConfig.findFirst()

    if (!config) {
        return reply.status(404).send({ message: 'System configuration not found.' })
    }

    return reply.send({
        merchandise: config.merchandise_module,
        financial: config.financial_module,
        treatments: config.treatments_module,
        hr_module: config.hr_module,
        cestaBasicaValue: Number(config.cestaBasicaValue || 0),
        financial_management_profile: config.financial_management_profile,
        // @ts-ignore - Cast temporário pois o Prisma Client local está em uso e não pôde ser regenerado (EPERM)
        dashboard_cards: (config as any).dashboard_cards 
    })
}
