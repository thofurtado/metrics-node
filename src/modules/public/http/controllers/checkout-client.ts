import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'

export async function checkoutClient(request: FastifyRequest, reply: FastifyReply) {
    const checkoutClientBodySchema = z.object({
        name: z.string(),
        phone: z.string(),
        street: z.string(),
        number: z.union([z.string(), z.number()]).transform(v => {
            const parsed = typeof v === 'number' ? v : parseInt(String(v).replace(/\D/g, ''), 10)
            return isNaN(parsed) ? 0 : parsed
        }),
        neighborhood: z.string(),
        city: z.string(),
        state: z.string(),
        zipcode: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional().transform(v => {
            if (!v) return undefined
            const parsed = typeof v === 'number' ? v : parseInt(String(v).replace(/\D/g, ''), 10)
            return isNaN(parsed) ? undefined : parsed
        }),
        isNewAddress: z.boolean().optional()
    })

    const { name, phone, street, number, neighborhood, city, state, zipcode, isNewAddress } = checkoutClientBodySchema.parse(request.body)

    let client = await prisma.client.findFirst({
        where: { phone }
    })

    if (!client) {
        client = await prisma.client.create({
            data: {
                name,
                phone,
                addresses: {
                    create: {
                        street,
                        number,
                        neighborhood,
                        city,
                        state,
                        zipcode,
                        is_main: true
                    }
                }
            },
            include: {
                addresses: true
            }
        }) as any;
    } else {
        // Verifica se nome mudou
        if (client.name !== name) {
            await prisma.client.update({
                where: { id: client.id },
                data: { name }
            })
        }

        // Busca se endereço com mesma rua e número já existe para este cliente
        const existingAddress = await prisma.address.findFirst({
            where: {
                client_id: client.id,
                street,
                number
            }
        })

        // Atualiza todos os endereços existentes para is_main = false
        await prisma.address.updateMany({
            where: { client_id: client.id },
            data: { is_main: false }
        })

        if (existingAddress && !isNewAddress) {
            // Reutiliza o endereço existente definindo-o como principal
            await prisma.address.update({
                where: { id: existingAddress.id },
                data: { is_main: true }
            })
        } else {
            // Cria o novo endereço principal
            await prisma.address.create({
                data: {
                    client_id: client.id,
                    street,
                    number,
                    neighborhood,
                    city,
                    state,
                    zipcode,
                    is_main: true
                }
            })
        }

        client = await prisma.client.findFirst({
            where: { id: client.id },
            include: {
                addresses: {
                    orderBy: [
                        { is_main: 'desc' },
                        { created_at: 'desc' }
                    ]
                }
            }
        }) as any;
    }

    return reply.status(200).send({ client })
}
