import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { sseManager } from '@/lib/sse-manager'

export async function ordersStream(request: FastifyRequest, reply: FastifyReply) {
    const rawDomain = (request.headers['x-tenant-domain'] as string) || request.hostname
    const domain = rawDomain.split(':')[0].replace(/^www\./, '').replace(/^api\./, '').toLowerCase().trim()

    // Configura cabeçalhos HTTP para Streaming SSE
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
    })

    // Registra conexão no SSE Manager
    const conn = sseManager.addConnection(domain, reply)

    // Envia evento inicial de confirmação de conexão
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', tenant: domain, timestamp: new Date() })}\n\n`)

    // Envia imediatamente pedidos pendentes atuais caso o PDV tenha acabado de ligar/reconectar
    const prisma = requestContext.get('prisma')
    if (prisma) {
        try {
            const pendingOrders = await prisma.treatment.findMany({
                where: {
                    status: 'pending',
                    request: {
                        contains: 'DELIVERY ONLINE'
                    }
                },
                include: {
                    client: {
                        include: {
                            addresses: {
                                where: { is_main: true }
                            }
                        }
                    },
                    items: {
                        include: {
                            product: true
                        }
                    }
                },
                orderBy: {
                    created_at: 'asc'
                }
            })

            for (const o of pendingOrders) {
                const orderDto = {
                    id: o.id,
                    display_id: o.display_id,
                    client_name: o.client?.name || 'Cliente',
                    client_phone: o.client?.phone || '',
                    address: o.client?.addresses?.[0]
                        ? `${o.client.addresses[0].street}, ${o.client.addresses[0].number} - ${o.client.addresses[0].neighborhood}`
                        : '',
                    total_amount: o.amount,
                    observations: o.observations,
                    created_at: o.created_at,
                    items: o.items.map(i => ({
                        id: i.id,
                        product_id: i.product_id,
                        name: i.product?.name || i.observation || 'Item',
                        quantity: i.quantity,
                        price: i.price,
                        observation: i.observation
                    }))
                }

                reply.raw.write(`event: new_order\ndata: ${JSON.stringify(orderDto)}\n\n`)
            }
        } catch (err) {
            console.error('[SSE] Erro ao carregar pedidos pendentes iniciais:', err)
        }
    }

    // Monitora fechamento de conexão
    request.raw.on('close', () => {
        sseManager.removeConnection(conn)
    })
}
