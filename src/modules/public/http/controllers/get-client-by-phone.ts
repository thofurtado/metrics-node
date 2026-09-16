import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { prisma as defaultPrisma } from '../../../../lib/prisma'

export async function getClientByPhone(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma') || defaultPrisma
    const getClientParamsSchema = z.object({
        phone: z.string()
    })

    const { phone } = getClientParamsSchema.parse(request.params)
    const rawDigits = phone.replace(/\D/g, '')
    let cleanPhone = rawDigits
    if ((cleanPhone.length === 12 || cleanPhone.length === 13) && cleanPhone.startsWith('55')) {
        cleanPhone = cleanPhone.substring(2)
    }

    const phoneVariants = [cleanPhone, phone]
    if (cleanPhone.length === 11 && cleanPhone[2] === '9') {
        phoneVariants.push(cleanPhone.slice(0, 2) + cleanPhone.slice(3))
        phoneVariants.push(cleanPhone.slice(0, 10))
    } else if (cleanPhone.length === 10) {
        phoneVariants.push(cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2))
    }

    const client = await prisma.client.findFirst({
        where: {
            phone: { in: Array.from(new Set(phoneVariants)) }
        },
        include: {
            addresses: {
                orderBy: [
                    { is_main: 'desc' },
                    { created_at: 'desc' }
                ]
            }
        }
    })

    if (!client) {
        return reply.status(404).send({ message: 'Client not found.' })
    }

    // Filtra endereços fantasmas de retirada
    const cleanAddresses = (client.addresses || []).filter(a => 
        !a.street?.toLowerCase().includes('retirada') &&
        !a.neighborhood?.toLowerCase().includes('balcão')
    )

    return reply.status(200).send({ client: { ...client, addresses: cleanAddresses } })
}
