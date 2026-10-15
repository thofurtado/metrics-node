import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { prisma as defaultPrisma } from '../../../../lib/prisma'
import { nomeProvisorio, normalizar, taxaDeEntrega } from '../../services/pedido-online-regras'
import { clientePublico } from './cliente-publico'

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
    const { name, phone, street, number, neighborhood, city, state, zipcode, complement } = body

    const rawDigits = phone.replace(/\D/g, '')
    let cleanPhone = rawDigits
    if ((cleanPhone.length === 12 || cleanPhone.length === 13) && cleanPhone.startsWith('55')) {
        cleanPhone = cleanPhone.substring(2)
    }

    const isTakeout = Boolean(body.isTakeout) ||
        street.toLowerCase().includes('retirada') ||
        neighborhood.toLowerCase().includes('balcão') ||
        !street || !neighborhood

    // Validação de Bairros Atendidos por Setor (quando Delivery): mesma regra do pedido e do cardápio
    // (antes recusava bairro fora dos setores até na política FALLBACK, que aceita qualquer bairro)
    if (!isTakeout && neighborhood) {
        const companyProfile = await prisma.companyProfile.findFirst()
        if (companyProfile && !taxaDeEntrega(companyProfile, neighborhood).atendido) {
            return reply.status(400).send({
                message: `Desculpe, o bairro "${neighborhood}" não está na área de entrega atendida pela loja.`
            })
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
        // Mergulho (06:C5, 15/10/2026): esta rota é pública e não confirma o dono do telefone (não há código por SMS ou
        // WhatsApp). Antes ela trocava o nome do cadastro e o endereço principal de quem tivesse o telefone digitado.
        // Agora, para cliente que já existe, ela só completa o que é seguro: o 9 do celular e o nome provisório
        // ("Cliente Delivery"). Nome diferente vai na observação do pedido e endereço novo é gravado com o pedido
        // (create-online-order.ts), sem tirar o principal nem alterar os endereços que já estão lá.
        const updateData: any = {}
        if (nomeProvisorio(client.name) && name.trim() && normalizar(name) !== normalizar(client.name)) {
            updateData.name = name.trim()
        }
        if (cleanPhone.length === 11 && (client.phone || '').length !== 11) {
            updateData.phone = cleanPhone
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.client.update({
                where: { id: client.id },
                data: updateData
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
        }) as any
    }

    // Só o que o cardápio usa (nome e endereços); documento, e-mail e o resto do cadastro não saem nesta rota pública
    return reply.status(200).send({ client: clientePublico(client) })
}
