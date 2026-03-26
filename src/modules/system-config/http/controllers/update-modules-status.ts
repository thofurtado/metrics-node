
import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function updateModulesStatus(request: FastifyRequest, reply: FastifyReply) {
    const updateBodySchema = z.object({
        merchandise: z.boolean(),
        financial: z.boolean(),
        treatments: z.boolean(),
        cestaBasicaValue: z.number().nullable().optional(),
        financial_management_profile: z.enum(['ANALYTICAL', 'OPERATIONAL']).optional(),
        dashboard_cards: z.record(z.record(z.boolean())).optional()
    })

    const { 
        merchandise, 
        financial, 
        treatments, 
        cestaBasicaValue, 
        financial_management_profile,
        dashboard_cards 
    } = updateBodySchema.parse(request.body)

    // Regra de Negócio: Removida a trava de dependência forte.
    // Atendimentos agora pode ficar ativo mesmo sem Mercadorias/Financeiro.
    const finalTreatments = treatments


    // Tenta buscar a assinatura existente para pegar o ID
    const existingConfig = await prisma.systemConfig.findFirst()

    let config

    if (existingConfig) {
        config = await prisma.systemConfig.update({
            where: {
                id: existingConfig.id,
            },
            data: {
                merchandise_module: merchandise,
                financial_module: financial,
                treatments_module: finalTreatments,
                cestaBasicaValue: (cestaBasicaValue !== undefined && cestaBasicaValue !== null) ? cestaBasicaValue : existingConfig.cestaBasicaValue,
                financial_management_profile: financial_management_profile ?? existingConfig.financial_management_profile,
                // @ts-ignore
                dashboard_cards: dashboard_cards ?? (existingConfig as any).dashboard_cards
            },
        })
    } else {
        config = await prisma.systemConfig.create({
            data: {
                merchandise_module: merchandise,
                financial_module: financial,
                treatments_module: finalTreatments,
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
