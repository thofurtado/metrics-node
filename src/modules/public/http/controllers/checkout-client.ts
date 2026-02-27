import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'

export async function checkoutClient(request: FastifyRequest, reply: FastifyReply) {
    const checkoutClientBodySchema = z.object({
        name: z.string(),
        phone: z.string(),
        street: z.string(),
        number: z.string().transform(v => parseInt(v, 10)).or(z.number()),
        neighborhood: z.string(),
        city: z.string(),
        state: z.string(),
        zipcode: z.string().transform(v => parseInt(v, 10)).or(z.number()).optional()
    })

    const { name, phone, street, number, neighborhood, city, state, zipcode } = checkoutClientBodySchema.parse(request.body)

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
        // Atualiza enderecos existentes para is_main false
        await prisma.address.updateMany({
            where: { client_id: client.id },
            data: { is_main: false }
        })

        // Verifica se nome mudou
        if (client.name !== name) {
            await prisma.client.update({
                where: { id: client.id },
                data: { name }
            })
        }

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

        client = await prisma.client.findFirst({
            where: { id: client.id },
            include: {
                addresses: {
                    orderBy: { created_at: 'desc' }
                }
            }
        }) as any;
    }

    return reply.status(200).send({ client })
}
