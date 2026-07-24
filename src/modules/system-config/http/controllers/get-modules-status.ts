import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'

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
        cashier: config.cashier_module,
        cashier_default_origin: (config as any).cashier_default_origin || 'Mesa',
        hr_module: config.hr_module,
        cestaBasicaValue: Number(config.cestaBasicaValue || 0),
        financial_management_profile: config.financial_management_profile,
        dashboard_cards: (config as any).dashboard_cards 
    })
}
