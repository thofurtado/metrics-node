import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'

export async function getModulesStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
        let config = await prisma.systemConfig.findFirst()

        if (!config) {
            config = await prisma.systemConfig.create({
                data: {}
            })
        }

        return reply.send({
            merchandise: config.merchandise_module,
            financial: config.financial_module,
            treatments: config.treatments_module,
            cashier: config.cashier_module,
            cashier_default_origin: (config as any).cashier_default_origin || 'Mesa',
            hr_module: config.hr_module,
            stock_control: (config as any).stock_control_module ?? false,
            cestaBasicaValue: Number(config.cestaBasicaValue || 0),
            financial_management_profile: config.financial_management_profile,
            dashboard_cards: (config as any).dashboard_cards 
        })
    } catch (err: any) {
        console.warn('[ModulesStatus] Fallback seguro ao ler systemConfig:', err.message)
        return reply.send({
            merchandise: true,
            financial: true,
            treatments: true,
            cashier: true,
            cashier_default_origin: 'Mesa',
            hr_module: true,
            stock_control: false,
            cestaBasicaValue: 0,
            financial_management_profile: 'ANALYTICAL',
            dashboard_cards: {}
        })
    }
}
