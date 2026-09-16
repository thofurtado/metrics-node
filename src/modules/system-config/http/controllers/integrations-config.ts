import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getIntegrationsConfig(request: FastifyRequest, reply: FastifyReply) {
    const config = await prisma.systemConfig.findFirst()

    const rawKey = config?.gemini_api_key || process.env.GEMINI_API_KEY || ''
    const maskedKey = rawKey.length > 8 
        ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`
        : (rawKey ? '********' : '')

    return reply.send({
        gemini: {
            hasKey: Boolean(rawKey),
            maskedKey,
            model: config?.gemini_model || 'gemini-1.5-flash',
            autoNfeMapping: config?.auto_nfe_mapping ?? true
        }
    })
}

export async function updateIntegrationsConfig(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        geminiApiKey: z.string().optional().nullable(),
        geminiModel: z.string().optional(),
        autoNfeMapping: z.boolean().optional()
    })

    const { geminiApiKey, geminiModel, autoNfeMapping } = bodySchema.parse(request.body)

    let config = await prisma.systemConfig.findFirst()

    if (!config) {
        config = await prisma.systemConfig.create({
            data: {
                gemini_api_key: geminiApiKey || null,
                gemini_model: geminiModel || 'gemini-1.5-flash',
                auto_nfe_mapping: autoNfeMapping ?? true
            }
        })
    } else {
        const updateData: any = {}
        if (geminiApiKey !== undefined) {
            updateData.gemini_api_key = geminiApiKey ? geminiApiKey.trim() : null
        }
        if (geminiModel !== undefined) {
            updateData.gemini_model = geminiModel
        }
        if (autoNfeMapping !== undefined) {
            updateData.auto_nfe_mapping = autoNfeMapping
        }

        config = await prisma.systemConfig.update({
            where: { id: config.id },
            data: updateData
        })
    }

    const rawKey = config.gemini_api_key || process.env.GEMINI_API_KEY || ''
    const maskedKey = rawKey.length > 8 
        ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`
        : (rawKey ? '********' : '')

    return reply.send({
        message: 'Configurações de integração atualizadas com sucesso.',
        gemini: {
            hasKey: Boolean(rawKey),
            maskedKey,
            model: config.gemini_model,
            autoNfeMapping: config.auto_nfe_mapping
        }
    })
}
