import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { prisma as defaultPrisma } from '../../../../lib/prisma'

export async function checkoutClient(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma') || defaultPrisma
    const checkoutClientBodySchema = z.object({
        name: z.string(),
        phone: z.string(),
        street: z.string(),
        number: z.union([z.string(), z.number()]).transform(v => String(v).trim()),
        neighborhood: z.string(),
        city: z.string(),
        state: z.string(),
        zipcode: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional().transform(v => {
            if (!v) return undefined
            return String(v).trim()
        }),
        complement: z.string().optional().nullable(),
        isNewAddress: z.boolean().optional()
    })

    const { name, phone, street, number, neighborhood, city, state, zipcode, complement, isNewAddress } = checkoutClientBodySchema.parse(request.body)
    const cleanPhone = phone.replace(/\D/g, '')

    // Validação de Bairros Atendidos por Setor (quando Delivery)
    const isTakeout = street.toLowerCase().includes('retirada') || neighborhood.toLowerCase().includes('balcão');
    if (!isTakeout) {
        const companyProfile = await prisma.companyProfile.findFirst();
        if (companyProfile) {
            let sectors = [];
            if (companyProfile.deliverySectors) {
                sectors = typeof companyProfile.deliverySectors === 'string'
                    ? JSON.parse(companyProfile.deliverySectors)
                    : companyProfile.deliverySectors;
            }
            const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            // Exige estritamente pertencimento a um setor de entrega
            const allowedNeighborhoods = (Array.isArray(sectors) ? sectors : [])
                .flatMap((s) => s.neighborhoods || [])
                .map((n) => norm(n))
                .filter(Boolean);

            if (allowedNeighborhoods.length > 0) {
                const normBairro = norm(neighborhood);
                const isCovered = allowedNeighborhoods.some((n) => n === normBairro);
                if (!isCovered) {
                    return reply.status(400).send({
                        message: `Desculpe, o bairro "${neighborhood}" não está na área de entrega atendida pela loja.`
                    });
                }
            }
        }
    }

    let client = await prisma.client.findFirst({
        where: {
            OR: [
                { phone: cleanPhone },
                { phone: phone }
            ]
        }
    })

    if (!client) {
        client = await prisma.client.create({
            data: {
                name,
                phone: cleanPhone || phone,
                addresses: {
                    create: {
                        street,
                        number,
                        neighborhood,
                        city,
                        state,
                        zipcode: zipcode || undefined,
                        complement: complement || undefined,
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
                data: {
                    is_main: true,
                    neighborhood,
                    city,
                    state,
                    zipcode: zipcode || undefined,
                    complement: complement || undefined
                }
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
                    zipcode: zipcode || undefined,
                    complement: complement || undefined,
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
