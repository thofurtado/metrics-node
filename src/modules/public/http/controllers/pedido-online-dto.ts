import { Address, Client, Pedido, PedidoItem, PrismaClient } from '@prisma/client'

type PedidoComItens = Pedido & { itens: PedidoItem[] }

/**
 * Pedido online no formato que o PDV e o painel recebem, igual na lista de pendentes (/api/pdv/orders/pending) e no aviso ao
 * vivo "new_order" que o canal manda quando o PDV liga ou reconecta.
 *
 * Antes o aviso ao vivo tinha um formato próprio e incompleto: sem bairro, cidade, CEP, taxa de entrega e troco, com o 1º
 * endereço do cliente no lugar do endereço do pedido e o nome do item trocado pela observação. O PDV que ligava com um pedido
 * pendente gravava o pedido com a taxa de entrega zerada e o aviso de novo pedido dizia "Bairro não informado" (09/10/2026).
 */
export async function montarPedidosOnline(prisma: PrismaClient, pedidos: PedidoComItens[]) {
    const clientIds = pedidos.map(p => p.cliente_id).filter(Boolean) as string[];
    const clients = await prisma.client.findMany({
        where: { id: { in: clientIds } }
    });
    const clientMap = new Map(clients.map(c => [c.id, c]));

    const addressIds = pedidos.map(p => p.endereco_entrega_id).filter(Boolean) as string[];
    const addresses = await prisma.address.findMany({
        where: { id: { in: addressIds } }
    });
    const addressMap = new Map(addresses.map(a => [a.id, a]));

    const productIds = pedidos.flatMap(p => p.itens.map(i => i.produto_id)).filter(Boolean) as string[];
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } }
    });
    const productMap = new Map(products.map(pr => [pr.id, pr.name]));

    return pedidos.map(p => pedidoOnlineDto(p, p.cliente_id ? clientMap.get(p.cliente_id) : null, addressMap, productMap));
}

const mappedStatus = (statusDelivery: string | null, status: string) => {
    if (status === 'Fechado' || statusDelivery === 'Entregue' || statusDelivery === 'Finalizado') return 'delivered';
    if (statusDelivery === 'SaiuEntrega' || statusDelivery === 'EmRota') return 'dispatched';
    if (statusDelivery === 'Conferencia') return 'conferencia';
    if (statusDelivery === 'EmPreparo' || statusDelivery === 'EmProducao') return 'in_preparation';
    if (status === 'Cancelado' || statusDelivery === 'Cancelado') return 'cancelled';
    return 'pending';
};

export function pedidoOnlineDto(
    p: PedidoComItens,
    client: Pick<Client, 'name' | 'phone'> | null | undefined,
    addressMap: Map<string, Pick<Address, 'street' | 'number' | 'neighborhood' | 'city' | 'zipcode'>>,
    productMap: Map<string, string>,
) {
    const isTakeout =
        p.origem === 'Balcão' ||
        p.origem === 'Balcao' ||
        p.origem === 'BalcÃ£o' ||
        p.origem === 'Retirada' ||
        p.origem === 'Takeout' ||
        (Boolean(p.observacao) && p.observacao!.toLowerCase().includes('retirada')) ||
        !p.endereco_entrega_id;

    // Prioriza o endereço histórico salvo no pedido em endereco_entrega_id somente se NÃO for retirada
    const orderAddr = (!isTakeout && p.endereco_entrega_id)
        ? addressMap.get(p.endereco_entrega_id)
        : null;

    const cityStr = orderAddr?.city ? `, ${orderAddr.city}` : '';
    const address = isTakeout
        ? 'Retirada no Balcão'
        : (orderAddr
            ? `${orderAddr.street}, ${orderAddr.number} - ${orderAddr.neighborhood}${cityStr}`
            : '');
    const neighborhood = isTakeout ? 'Balcão' : (orderAddr?.neighborhood || '');
    const city = isTakeout ? '' : (orderAddr?.city || '');
    const zipcode = isTakeout ? '' : (orderAddr?.zipcode || '');

    return {
        id: p.uuid,
        display_id: p.display_id,
        origem: p.origem,
        is_takeout: isTakeout,
        status: mappedStatus(p.status_delivery, p.status),
        status_delivery: p.status_delivery || 'Pendente',
        raw_status: p.status || 'Aberto',
        client_name: client?.name || 'Cliente',
        client_phone: client?.phone || '',
        // CPF/CNPJ na nota (iFood: o que o cliente informou no app), para a NFC-e do delivery no PDV
        client_document: p.cpf_na_nota || null,
        address: address,
        neighborhood: neighborhood,
        city: city,
        zipcode: zipcode,
        total_amount: p.valor_final,
        delivery_fee: p.valor_frete || 0,
        delivery_man: p.entregador || null,
        departed_at: p.hora_saida_rota || null,
        observations: p.observacao || '',
        caixa_id: p.caixa_id || null,
        change_for: p.valor_troco ? Number(p.valor_troco) : undefined,
        created_at: p.data_abertura,
        items: p.itens.map(i => {
            let complements: any[] = [];
            try {
                complements = i.complementos_json ? JSON.parse(i.complementos_json) : [];
            } catch (e) {}

            return {
                id: i.uuid || String(i.id),
                product_id: i.produto_id || undefined,
                name: productMap.get(i.produto_id || '') || 'Item',
                quantity: i.quantidade,
                price: i.valor_unitario,
                observation: i.observacao || '',
                observations: i.observacao || '',
                notes: i.observacao || '',
                complements: complements
            };
        })
    };
}
