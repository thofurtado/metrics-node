import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { sseManager } from '@/lib/sse-manager'

export async function ordersStream(request: FastifyRequest, reply: FastifyReply) {
    const queryTenant = (request.query as { tenant?: string })?.tenant;
    const headerTenant = request.headers['x-tenant-domain'] as string;
    const rawDomain = queryTenant || headerTenant || request.hostname;
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
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const pendingPedidos = await prisma.pedido.findMany({
                where: {
                    origem: 'Delivery',
                    status: 'Aberto',
                    data_abertura: {
                        gte: today
                    }
                },
                include: {
                    itens: true
                },
                orderBy: {
                    data_abertura: 'asc'
                }
            })

            const clientIds = pendingPedidos.map(p => p.cliente_id).filter(Boolean) as string[];
            const clients = await prisma.client.findMany({
                where: { id: { in: clientIds } },
                include: { addresses: true }
            });
            const clientMap = new Map(clients.map(c => [c.id, c]));

            for (const p of pendingPedidos) {
                const client = p.cliente_id ? clientMap.get(p.cliente_id) : null;
                const address = client?.addresses?.[0]
                    ? `${client.addresses[0].street}, ${client.addresses[0].number} - ${client.addresses[0].neighborhood}`
                    : '';

                const orderDto = {
                    id: p.uuid,
                    display_id: p.display_id,
                    client_name: client?.name || 'Cliente',
                    client_phone: client?.phone || '',
                    address: address,
                    total_amount: p.valor_final,
                    observations: p.observacao || '',
                    created_at: p.data_abertura,
                    items: p.itens.map(i => ({
                        id: i.uuid,
                        product_id: i.produto_id,
                        name: i.observacao || 'Item',
                        quantity: i.quantidade,
                        price: i.valor_unitario,
                        observation: i.observacao
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
