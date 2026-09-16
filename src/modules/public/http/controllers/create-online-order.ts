import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { sseManager } from '@/lib/sse-manager'

export async function createOnlineOrder(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    const createOnlineOrderSchema = z.object({
        uuid: z.string().uuid().optional(),
        display_id: z.number().optional(),
        origin: z.string().optional().default('Delivery'),
        status_delivery: z.string().optional(),
        status: z.string().optional(),
        client_name: z.string(),
        client_phone: z.string(),
        street: z.string().optional().default(''),
        number: z.union([z.string(), z.number()]).optional().transform(v => v !== undefined && v !== null ? String(v).trim() : ''),
        neighborhood: z.string().optional().default(''),
        city: z.string().optional().default(''),
        state: z.string().optional().default(''),
        zipcode: z.string().optional(),
        complement: z.string().optional(),
        reference: z.string().optional(),
        payment_method_id: z.string().optional(),
        payment_method_name: z.string().default('Dinheiro'),
        change_for: z.number().optional(),
        delivery_fee: z.number().default(0),
        total_amount: z.number(),
        notes: z.string().optional(),
        items: z.array(z.object({
            product_id: z.string().optional(),
            name: z.string(),
            quantity: z.number(),
            unit_price: z.number(),
            unit_cost: z.number().optional().default(0),
            notes: z.string().optional(),
            complements: z.array(z.object({
                name: z.string(),
                price: z.number().default(0),
                quantity: z.number().default(1)
            })).optional(),
            fractions: z.array(z.object({
                product_id: z.string(),
                name: z.string(),
                fraction: z.number().default(0.5)
            })).optional()
        }))
    })

    const body = createOnlineOrderSchema.parse(request.body)

    try {
        const isTakeout = 
            (body.origin === 'Balcão') ||
            body.street.toLowerCase().includes('retirada') || 
            body.neighborhood.toLowerCase().includes('balcão') || 
            (Boolean(body.notes) && body.notes!.toLowerCase().includes('retirada')) ||
            !body.street || !body.neighborhood

        let resolvedDeliveryFee = isTakeout ? 0 : body.delivery_fee

        const companyProfile = await prisma.companyProfile.findFirst()

        if (!isTakeout && companyProfile) {
            let sectors: any[] = []
            if (companyProfile.deliverySectors) {
                sectors = typeof companyProfile.deliverySectors === 'string' 
                    ? JSON.parse(companyProfile.deliverySectors) 
                    : companyProfile.deliverySectors
            }
            const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
            
            if (Array.isArray(sectors) && sectors.length > 0) {
                const normOrderBairro = norm(body.neighborhood)
                const matchedSector = sectors.find((s: any) =>
                    (s.neighborhoods || []).some((n: string) => norm(n) === normOrderBairro)
                )

                if (matchedSector && matchedSector.fee !== undefined) {
                    resolvedDeliveryFee = Number(matchedSector.fee)
                } else {
                    // Se não está em nenhum setor, valida se loja restringe bairros
                    const allowedNeighborhoods = sectors
                        .flatMap((s: any) => s.neighborhoods || [])
                        .map((n: string) => norm(n))
                        .filter(Boolean)

                    if (allowedNeighborhoods.length > 0 && !allowedNeighborhoods.includes(normOrderBairro)) {
                        return reply.status(400).send({
                            message: `Desculpe, o bairro "${body.neighborhood}" não está na área de entrega atendida pela loja.`
                        })
                    }
                }
            }
        }

        const rawDigits = body.client_phone.replace(/\D/g, '')
        let cleanPhone = rawDigits
        if ((cleanPhone.length === 12 || cleanPhone.length === 13) && cleanPhone.startsWith('55')) {
            cleanPhone = cleanPhone.substring(2)
        }

        const phoneVariants = [cleanPhone, body.client_phone]
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

        let targetAddressId: string | null = null
        const norm = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

        if (!client) {
            const addressData = (!isTakeout && body.street && body.neighborhood) ? {
                create: {
                    street: body.street,
                    number: String(body.number || 'S/N'),
                    neighborhood: body.neighborhood,
                    city: body.city || 'Cidade',
                    state: body.state || 'SP',
                    zipcode: body.zipcode ? String(body.zipcode) : undefined,
                    complement: body.complement || undefined,
                    is_main: true
                }
            } : undefined

            client = await prisma.client.create({
                data: {
                    name: body.client_name,
                    phone: cleanPhone || body.client_phone,
                    ...(addressData ? { addresses: addressData } : {})
                },
                include: {
                    addresses: true
                }
            })
            targetAddressId = (!isTakeout && client.addresses?.[0]) ? client.addresses[0].id : null
        } else {
            // Se o cliente já existia:
            // Atualiza telefone para 11 dígitos caso estivesse com 10
            if (cleanPhone.length === 11 && client.phone.length !== 11) {
                await prisma.client.update({
                    where: { id: client.id },
                    data: { phone: cleanPhone }
                })
            }

            // Para Retirada, NUNCA criamos endereço!
            if (!isTakeout && body.street && body.neighborhood) {
                const matchingAddr = client.addresses?.find(a => 
                    norm(a.street) === norm(body.street) &&
                    norm(a.number) === norm(body.number)
                )

                if (matchingAddr) {
                    targetAddressId = matchingAddr.id
                } else {
                    const newAddr = await prisma.address.create({
                        data: {
                            client_id: client.id,
                            street: body.street,
                            number: String(body.number || 'S/N'),
                            neighborhood: body.neighborhood,
                            city: body.city || 'Cidade',
                            state: body.state || 'SP',
                            zipcode: body.zipcode ? String(body.zipcode) : undefined,
                            complement: body.complement || undefined,
                            is_main: false
                        }
                    })
                    targetAddressId = newAddr.id
                }
            }
        }

        if (body.uuid) {
            const existingByUuid = await prisma.pedido.findFirst({
                where: { uuid: body.uuid },
                include: { itens: true }
            })
            if (existingByUuid) {
                return reply.status(200).send({
                    order: {
                        id: existingByUuid.uuid,
                        display_id: existingByUuid.display_id,
                        total_amount: existingByUuid.valor_final,
                        status: existingByUuid.status_delivery
                    }
                })
            }
        }

        // Trava Anti-Duplicidade (Idempotência)
        const recentDuplicateWindow = new Date(Date.now() - 2 * 60 * 1000)
        const existingRecentOrder = await prisma.pedido.findFirst({
            where: {
                cliente_id: client.id,
                valor_final: body.total_amount,
                data_abertura: { gte: recentDuplicateWindow }
            },
            include: { itens: true },
            orderBy: { data_abertura: 'desc' }
        })

        if (existingRecentOrder) {
            return reply.status(200).send({
                order: {
                    id: existingRecentOrder.uuid,
                    display_id: existingRecentOrder.display_id,
                    total_amount: existingRecentOrder.valor_final,
                    status: existingRecentOrder.status_delivery
                }
            })
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const countToday = await prisma.pedido.count({
            where: {
                data_abertura: { gte: today }
            }
        })
        const displayId = countToday + 1

        const infoPagamento = body.change_for ? body.payment_method_name + ' (Troco para R$ ' + body.change_for.toFixed(2) + ')' : body.payment_method_name
        
        const obsPrefix = isTakeout ? '[Retirada no Balcão]' : 'Entrega (Delivery)'
        const fullObservations = [
            obsPrefix,
            'Pagamento: ' + infoPagamento,
            isTakeout ? 'Frete: R$ 0.00 (Retirada)' : 'Taxa: R$ ' + resolvedDeliveryFee.toFixed(2),
            body.reference ? 'Ref: ' + body.reference : null,
            body.notes ? 'Obs: ' + body.notes : null
        ].filter(Boolean).join(' | ')

        const subtotal = Math.max(0, body.total_amount - resolvedDeliveryFee)

        const activeCashier = await prisma.cashierSession.findFirst({
            where: { status: 'OPEN' },
            orderBy: { opened_at: 'desc' }
        })

        const pedido = await prisma.pedido.create({
            data: {
                uuid: body.uuid || undefined,
                display_id: body.display_id || displayId,
                numero_diario: body.display_id || displayId,
                origem: isTakeout ? 'Balcao' : (body.origin || 'Delivery'),
                caixa_id: activeCashier?.id || null,
                cliente_id: client.id,
                endereco_entrega_id: targetAddressId,
                subtotal: subtotal,
                valor_frete: resolvedDeliveryFee,
                valor_final: body.total_amount,
                valor_troco: body.change_for || 0,
                status: body.status || 'Aberto',
                status_delivery: body.status_delivery || 'Pendente',
                observacao: fullObservations,
                sincronizado_web: true,
                itens: {
                    create: body.items.map(item => {
                        const itemNotes = item.notes ? item.notes.trim() : null
                        return {
                            produto_id: (item.product_id && item.product_id.length > 10) ? item.product_id : undefined,
                            quantidade: item.quantity,
                            valor_unitario: item.unit_price,
                            valor_total: item.unit_price * item.quantity,
                            observacao: itemNotes,
                            complementos_json: item.complements && item.complements.length > 0 ? JSON.stringify(item.complements) : null
                        }
                    })
                }
            },
            include: {
                itens: true
            }
        })

        // Notifica via SSE
        try {
            const queryTenant = (request.query as { tenant?: string })?.tenant
            const headerTenant = request.headers['x-tenant-domain'] as string
            const originHost = request.headers.origin ? request.headers.origin.replace(/^https?:\/\//, '').split(':')[0] : ''
            const host = queryTenant || headerTenant || originHost || (request.headers.host || '').split(':')[0] || request.hostname
            
            const targetAddress = client.addresses?.find(a => a.id === targetAddressId)
            const addressStr = isTakeout 
                ? 'Retirada no Balcão (Sem Entrega)'
                : (targetAddress 
                    ? `${targetAddress.street}, ${targetAddress.number} - ${targetAddress.neighborhood}`
                    : `${body.street}, ${body.number} - ${body.neighborhood}`)

            const fullOrderDto = {
                id: pedido.uuid,
                order_id: pedido.uuid,
                display_id: pedido.display_id,
                client_name: client.name,
                client_phone: client.phone,
                is_takeout: isTakeout,
                address: addressStr,
                neighborhood: isTakeout ? 'Balcão' : (targetAddress?.neighborhood || body.neighborhood),
                city: targetAddress?.city || body.city,
                zipcode: targetAddress?.zipcode || body.zipcode,
                total_amount: pedido.valor_final,
                delivery_fee: pedido.valor_frete,
                observations: pedido.observacao || '',
                created_at: pedido.data_abertura,
                items: (pedido.itens || []).map((i, idx) => ({
                    id: i.uuid,
                    product_id: i.produto_id || body.items[idx]?.product_id || '',
                    name: body.items[idx]?.name || i.observacao || 'Item',
                    quantity: i.quantidade,
                    price: i.valor_unitario,
                    observation: i.observacao,
                    complements: i.complementos_json ? JSON.parse(i.complementos_json) : []
                }))
            }

            sseManager.notifyTenant(host, 'new_order', fullOrderDto)
            sseManager.broadcast('new_order', fullOrderDto, host)
        } catch (sseErr) {
            console.error('Erro ao emitir evento SSE de novo pedido:', sseErr)
        }

        return reply.status(201).send({
            order: {
                id: pedido.uuid,
                display_id: pedido.display_id,
                total_amount: pedido.valor_final,
                status: pedido.status_delivery
            }
        })
    } catch (error: any) {
        console.error('Erro ao criar pedido online:', error)
        return reply.status(500).send({
            message: 'Erro interno ao processar o pedido online.',
            error: error.message
        })
    }
}
