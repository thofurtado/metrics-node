import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { sseManager, bancoDaRequisicao } from '@/lib/sse-manager'
import { intervaloDoDiaOperacional } from '@/lib/dia-operacional'

export async function ordersStream(request: FastifyRequest, reply: FastifyReply) {
    // O banco da loja vem do gancho de toda requisição (domínio, x-tenant-domain ou ?tenant=). Os avisos são mandados
    // pelo banco, nunca pelo domínio (ver sse-manager.ts).
    const banco = bancoDaRequisicao()
    if (!banco) {
        return reply.status(403).send({ message: 'Loja não identificada para o canal ao vivo.' })
    }

    // Configura cabeçalhos HTTP para Streaming SSE
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
    })

    // Registra conexão no SSE Manager
    const conn = sseManager.addConnection(banco, reply)

    // Envia evento inicial de confirmação de conexão
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', tenant: banco, timestamp: new Date() })}\n\n`)

    // Envia imediatamente pedidos pendentes atuais caso o PDV tenha acabado de ligar/reconectar
    const prisma = requestContext.get('prisma')
    if (prisma) {
        try {
            // Dia operacional (vira às 05:00): um PDV que reconecta depois da meia-noite recebe os pendentes da noite
            const today = intervaloDoDiaOperacional().inicio;

            const pendingPedidos = await prisma.pedido.findMany({
                where: {
                    origem: 'Delivery',
                    status: 'Aberto',
                    status_delivery: 'Pendente',
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
                    client_document: p.cpf_na_nota || null,
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
