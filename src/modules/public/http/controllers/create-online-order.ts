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
        street: z.string(),
        number: z.union([z.string(), z.number()]).transform(v => String(v)),
        neighborhood: z.string(),
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
        // Validação rigorosa de Bairros Atendidos por Setor e Lista de Bairros (quando Delivery)
        const isTakeout = (body.origin === 'PDV') || body.street.toLowerCase().includes('retirada') || body.neighborhood.toLowerCase().includes('balcão');
        if (!isTakeout) {
            const companyProfile = await prisma.companyProfile.findFirst();
            if (companyProfile) {
                let sectors: any[] = [];
                if (companyProfile.deliverySectors) {
                    sectors = typeof companyProfile.deliverySectors === 'string' 
                        ? JSON.parse(companyProfile.deliverySectors) 
                        : companyProfile.deliverySectors;
                }
                const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                // Exige estritamente pertencimento a um setor de entrega
                const allowedNeighborhoods = (Array.isArray(sectors) ? sectors : [])
                    .flatMap((s: any) => s.neighborhoods || [])
                    .map((n: string) => norm(n))
                    .filter(Boolean);

                if (allowedNeighborhoods.length > 0) {
                    const normOrderBairro = norm(body.neighborhood);
                    const isCovered = allowedNeighborhoods.some(n => n === normOrderBairro);
                    if (!isCovered) {
                        return reply.status(400).send({
                            message: `Desculpe, o bairro "${body.neighborhood}" não está na área de entrega atendida pela loja.`
                        });
                    }
                }
            }
        }
        const cleanPhone = body.client_phone.replace(/\D/g, '');
        let client = await prisma.client.findFirst({
            where: {
                OR: [
                    { phone: cleanPhone },
                    { phone: body.client_phone }
                ]
            },
            include: {
                addresses: true
            }
        });

        let targetAddressId: string | null = null;

        if (!client) {
            client = await prisma.client.create({
                data: {
                    name: body.client_name,
                    phone: cleanPhone || body.client_phone,
                    addresses: {
                        create: {
                            street: body.street,
                            number: String(body.number || 'S/N'),
                            neighborhood: body.neighborhood,
                            city: body.city || 'Cidade',
                            state: body.state || 'UF',
                            zipcode: body.zipcode ? String(body.zipcode) : undefined,
                            complement: body.complement || undefined,
                            is_main: true
                        }
                    }
                },
                include: {
                    addresses: true
                }
            });
            targetAddressId = client.addresses?.[0]?.id || null;
        } else {
            // Verifica se o endereço já existe na lista do cliente para reaproveitar
            const norm = (s?: string) => (s || '').trim().toLowerCase();
            const matchingAddr = client.addresses?.find(a => 
                norm(a.street) === norm(body.street) &&
                norm(a.number) === norm(body.number) &&
                norm(a.neighborhood) === norm(body.neighborhood) &&
                norm(a.city) === norm(body.city)
            );

            if (matchingAddr) {
                targetAddressId = matchingAddr.id;
            } else {
                // Cria NOVO registro de endereço para o cliente, preservando os pedidos e endereços anteriores intactos
                const newAddr = await prisma.address.create({
                    data: {
                        client_id: client.id,
                        street: body.street,
                        number: String(body.number || 'S/N'),
                        neighborhood: body.neighborhood,
                        city: body.city || 'Cidade',
                        state: body.state || 'UF',
                        zipcode: body.zipcode ? String(body.zipcode) : undefined,
                        complement: body.complement || undefined,
                        is_main: false
                    }
                });
                targetAddressId = newAddr.id;
            }
        }

        if (body.uuid) {
            const existingByUuid = await prisma.pedido.findFirst({
                where: { uuid: body.uuid },
                include: { itens: true }
            });
            if (existingByUuid) {
                console.log('[PDV Sync] Pedido existente por UUID reaproveitado:', existingByUuid.uuid);
                return reply.status(200).send({
                    order: {
                        id: existingByUuid.uuid,
                        display_id: existingByUuid.display_id,
                        total_amount: existingByUuid.valor_final,
                        status: existingByUuid.status_delivery
                    }
                });
            }
        }

        // Trava Anti-Duplicidade (Idempotência): Se já existir um pedido recente do mesmo cliente nos últimos 3 minutos com o mesmo valor, reaproveita o existente
        const recentDuplicateWindow = new Date(Date.now() - 3 * 60 * 1000);
        const existingRecentOrder = await prisma.pedido.findFirst({
            where: {
                cliente_id: client.id,
                origem: 'Delivery',
                valor_final: body.total_amount,
                data_abertura: { gte: recentDuplicateWindow }
            },
            include: {
                itens: true
            },
            orderBy: {
                data_abertura: 'desc'
            }
        });

        if (existingRecentOrder) {
            console.log('[Anti-Duplicidade] Pedido duplicado interceptado para o cliente:', client.id, 'Retornando pedido existente:', existingRecentOrder.uuid);
            return reply.status(200).send({
                order: {
                    id: existingRecentOrder.uuid,
                    display_id: existingRecentOrder.display_id,
                    total_amount: existingRecentOrder.valor_final,
                    status: existingRecentOrder.status_delivery
                }
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const countToday = await prisma.pedido.count({
            where: {
                data_abertura: { gte: today }
            }
        });
        const displayId = countToday + 1;

        const infoPagamento = body.change_for ? body.payment_method_name + ' (Troco para R$ ' + body.change_for.toFixed(2) + ')' : body.payment_method_name;
        
        const fullObservations = [
            'Pagamento: ' + infoPagamento,
            'Taxa: R$ ' + body.delivery_fee.toFixed(2),
            body.reference ? 'Ref: ' + body.reference : null,
            body.notes ? 'Obs: ' + body.notes : null
        ].filter(Boolean).join(' | ');

        const subtotal = Math.max(0, body.total_amount - body.delivery_fee);

        // Busca a última sessão de caixa aberta para vincular automaticamente todo pedido novo
        const activeCashier = await prisma.cashierSession.findFirst({
            where: { status: 'OPEN' },
            orderBy: { opened_at: 'desc' }
        });

        const pedido = await prisma.pedido.create({
            data: {
                uuid: body.uuid || undefined,
                display_id: body.display_id || displayId,
                numero_diario: body.display_id || displayId,
                origem: body.origin || 'Delivery',
                caixa_id: activeCashier?.id || null,
                cliente_id: client.id,
                endereco_entrega_id: targetAddressId,
                subtotal: subtotal,
                valor_frete: body.delivery_fee,
                valor_final: body.total_amount,
                valor_troco: body.change_for || 0,
                status: body.status || 'Aberto',
                status_delivery: body.status_delivery || 'Pendente',
                observacao: fullObservations,
                sincronizado_web: true,
                itens: {
                    create: body.items.map(item => {
                        const itemNotes = item.notes ? item.notes.trim() : null;
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
        });

        // Notifica via Server-Sent Events (SSE)
        try {
            const queryTenant = (request.query as { tenant?: string })?.tenant;
            const headerTenant = request.headers['x-tenant-domain'] as string;
            const originHost = request.headers.origin ? request.headers.origin.replace(/^https?:\/\//, '').split(':')[0] : '';
            const host = queryTenant || headerTenant || originHost || (request.headers.host || '').split(':')[0] || request.hostname;
            
            const targetAddress = client.addresses?.find(a => a.id === targetAddressId) || client.addresses?.[0];
            const addressStr = targetAddress
                ? `${targetAddress.street}, ${targetAddress.number} - ${targetAddress.neighborhood}`
                : `${body.street}, ${body.number} - ${body.neighborhood}`;

            const fullOrderDto = {
                id: pedido.uuid,
                order_id: pedido.uuid,
                display_id: pedido.display_id,
                client_name: client.name,
                client_phone: client.phone,
                address: addressStr,
                neighborhood: targetAddress?.neighborhood || body.neighborhood,
                city: targetAddress?.city || body.city,
                zipcode: targetAddress?.zipcode || body.zipcode,
                total_amount: pedido.valor_final,
                delivery_fee: pedido.valor_frete,
                observations: pedido.observacao || '',
                created_at: pedido.data_abertura,
                items: (pedido.itens || []).map(i => ({
                    id: i.uuid,
                    name: i.observacao || 'Item',
                    quantity: i.quantidade,
                    price: i.valor_unitario,
                    observation: i.observacao,
                    complements: i.complementos_json ? JSON.parse(i.complementos_json) : []
                }))
            };

            sseManager.notifyTenant(host, 'new_order', fullOrderDto);
            sseManager.broadcast('new_order', fullOrderDto, host);
        } catch (sseErr) {
            console.error('Erro ao emitir evento SSE de novo pedido:', sseErr);
        }

        return reply.status(201).send({
            order: {
                id: pedido.uuid,
                display_id: pedido.display_id,
                total_amount: pedido.valor_final,
                status: pedido.status_delivery
            }
        });
    } catch (error: any) {
        console.error('Erro ao criar pedido online:', error);
        return reply.status(500).send({
            message: 'Erro interno ao processar o pedido online.',
            error: error.message
        });
    }
}

