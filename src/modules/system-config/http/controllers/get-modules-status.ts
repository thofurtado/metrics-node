
import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getModulesStatus(request: FastifyRequest, reply: FastifyReply) {
    // Tenta buscar a configuração existente
    let config = await prisma.systemConfig.findFirst()

    // Se não existir, cria uma padrão
    if (!config) {
        config = await prisma.systemConfig.create({
            data: {
                merchandise_module: true,
                financial_module: true,
                treatments_module: true,
            },
        })
    }

    return reply.send({
        merchandise: config.merchandise_module,
        financial: config.financial_module,
        treatments: config.treatments_module,
    })
}
