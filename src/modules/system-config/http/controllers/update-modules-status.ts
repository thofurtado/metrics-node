
import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function updateModulesStatus(request: FastifyRequest, reply: FastifyReply) {
    const updateBodySchema = z.object({
        merchandise: z.boolean().optional(),
        financial: z.boolean().optional(),
        treatments: z.boolean().optional(),
        cashier: z.boolean().optional(),
        hr_module: z.boolean().optional(),
        cestaBasicaValue: z.coerce.number().nullable().optional(),
        financial_management_profile: z.enum(['ANALYTICAL', 'OPERATIONAL']).optional(),
        dashboard_cards: z.any().optional()
    })

    const { 
        merchandise, 
        financial, 
        treatments, 
        cashier,
        hr_module,
        cestaBasicaValue, 
        financial_management_profile,
        dashboard_cards 
    } = updateBodySchema.parse(request.body)

    // Tenta buscar a assinatura existente para pegar o ID
    const existingConfig = await prisma.systemConfig.findFirst()

    let config

    if (existingConfig) {
        config = await prisma.systemConfig.update({
            where: {
                id: existingConfig.id,
            },
            data: {
                merchandise_module: merchandise ?? existingConfig.merchandise_module,
                financial_module: financial ?? existingConfig.financial_module,
                treatments_module: treatments ?? existingConfig.treatments_module,
                cashier_module: cashier ?? existingConfig.cashier_module,
                hr_module: hr_module ?? existingConfig.hr_module,
                cestaBasicaValue: (cestaBasicaValue !== undefined && cestaBasicaValue !== null) ? cestaBasicaValue : existingConfig.cestaBasicaValue,
                financial_management_profile: financial_management_profile ?? existingConfig.financial_management_profile,
                // @ts-ignore
                dashboard_cards: dashboard_cards ?? (existingConfig as any).dashboard_cards
            },
        })
    } else {
        config = await prisma.systemConfig.create({
            data: {
                merchandise_module: merchandise ?? true,
                financial_module: financial ?? true,
                treatments_module: treatments ?? true,
                cashier_module: cashier ?? false,
                hr_module: hr_module ?? true,
                cestaBasicaValue: cestaBasicaValue ?? 0,
                financial_management_profile: financial_management_profile ?? 'ANALYTICAL',
                // @ts-ignore
                dashboard_cards: dashboard_cards ?? {}
            },
        })
    }

    return reply.send({
        merchandise: config.merchandise_module,
        financial: config.financial_module,
        treatments: config.treatments_module,
        hr_module: config.hr_module,
        cestaBasicaValue: Number(config.cestaBasicaValue || 0),
        financial_management_profile: config.financial_management_profile
    })
}
