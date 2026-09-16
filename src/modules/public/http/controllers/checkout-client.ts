import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { prisma as defaultPrisma } from '../../../../lib/prisma'

export async function checkoutClient(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma') || defaultPrisma
    const checkoutClientBodySchema = z.object({
        name: z.string(),
        phone: z.string(),
        street: z.string().optional().default(''),
        number: z.union([z.string(), z.number()]).optional().transform(v => v !== undefined && v !== null ? String(v).trim() : ''),
        neighborhood: z.string().optional().default(''),
        city: z.string().optional().default(''),
        state: z.string().optional().default(''),
        zipcode: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional().transform(v => {
            if (!v) return undefined
            return String(v).trim()
        }),
        complement: z.string().optional().nullable(),
        isNewAddress: z.boolean().optional(),
        isTakeout: z.boolean().optional()
    })

    const body = checkoutClientBodySchema.parse(request.body)
    const { name, phone, street, number, neighborhood, city, state, zipcode, complement, isNewAddress } = body

    const rawDigits = phone.replace(/\D/g, '')
    let cleanPhone = rawDigits
    if ((cleanPhone.length === 12 || cleanPhone.length === 13) && cleanPhone.startsWith('55')) {
        cleanPhone = cleanPhone.substring(2)
    }

    const isTakeout = Boolean(body.isTakeout) || 
        street.toLowerCase().includes('retirada') || 
        neighborhood.toLowerCase().includes('balcão') ||
        !street || !neighborhood

    // Validação de Bairros Atendidos por Setor (quando Delivery)
    if (!isTakeout && neighborhood) {
        const companyProfile = await prisma.companyProfile.findFirst()
        if (companyProfile) {
            let sectors: any[] = []
            if (companyProfile.deliverySectors) {
                sectors = typeof companyProfile.deliverySectors === 'string'
                    ? JSON.parse(companyProfile.deliverySectors)
                    : companyProfile.deliverySectors
            }
            const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
            const allowedNeighborhoods = (Array.isArray(sectors) ? sectors : [])
                .flatMap((s: any) => s.neighborhoods || [])
                .map((n: string) => norm(n))
                .filter(Boolean)

            if (allowedNeighborhoods.length > 0) {
                const normBairro = norm(neighborhood)
                const isCovered = allowedNeighborhoods.some((n) => n === normBairro)
                if (!isCovered) {
                    return reply.status(400).send({
                        message: `Desculpe, o bairro "${neighborhood}" não está na área de entrega atendida pela loja.`
                    })
                }
            }
        }
    }

    const phoneVariants = [cleanPhone, phone]
    if (cleanPhone.length === 11 && cleanPhone[2] === '9') {
        phoneVariants.push(cleanPhone.slice(0, 2) + cleanPhone.slice(3))
        phoneVariants.push(cleanPhone.slice(0, 10))
    } else if (cleanPhone.length === 10) {
        phoneVariants.push(cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2))
    }

    let client = await prisma.client.findFirst({
        where: {
            phone: { in: Array.from(new Set(phoneVariants)) }
        },
        include: {
            addresses: true
        }
    })

    const norm = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

    if (!client) {
        // Cria cliente novo
        const addressData = (!isTakeout && street && neighborhood) ? {
            create: {
                street,
                number: number || 'S/N',
                neighborhood,
                city: city || 'Local',
                state: state || 'SP',
                zipcode: zipcode || undefined,
                complement: complement || undefined,
                is_main: true
            }
        } : undefined

        client = await prisma.client.create({
            data: {
                name,
                phone: cleanPhone || phone,
                ...(addressData ? { addresses: addressData } : {})
            },
            include: {
                addresses: true
            }
        }) as any
    } else {
        // Atualiza cliente existente
        const updateData: any = {}
        if (client.name !== name) {
            updateData.name = name
        }
        // Se o telefone anterior estava com 10 dígitos e agora temos 11 dígitos, atualiza para o formato completo
        if (cleanPhone.length === 11 && client.phone.length !== 11) {
            updateData.phone = cleanPhone
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.client.update({
                where: { id: client.id },
                data: updateData
            })
        }

        // Se for Retirada no Balcão, NÃO mexe nem cria nenhum endereço!
        if (!isTakeout && street && neighborhood) {
            const existingAddress = client.addresses?.find(a => 
                norm(a.street) === norm(street) && 
                norm(a.number) === norm(number)
            )

            await prisma.address.updateMany({
                where: { client_id: client.id },
                data: { is_main: false }
            })

            if (existingAddress && !isNewAddress) {
                // Reutiliza o endereço existente sem duplicar
                await prisma.address.update({
                    where: { id: existingAddress.id },
                    data: {
                        is_main: true,
                        neighborhood,
                        city: city || existingAddress.city,
                        state: state || existingAddress.state,
                        zipcode: zipcode || existingAddress.zipcode || undefined,
                        complement: complement || existingAddress.complement || undefined
                    }
                })
            } else {
                // Cria novo endereço
                await prisma.address.create({
                    data: {
                        client_id: client.id,
                        street,
                        number: number || 'S/N',
                        neighborhood,
                        city: city || 'Local',
                        state: state || 'SP',
                        zipcode: zipcode || undefined,
                        complement: complement || undefined,
                        is_main: true
                    }
                })
            }
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
        }) as any
    }

    // Filtra endereços fantasmas de retirada
    const cleanAddresses = (client.addresses || []).filter(a => 
        !a.street?.toLowerCase().includes('retirada') &&
        !a.neighborhood?.toLowerCase().includes('balcão')
    )

    return reply.status(200).send({ client: { ...client, addresses: cleanAddresses } })
}
