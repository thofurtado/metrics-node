/**
 * O que as rotas públicas do cardápio devolvem de um cliente (Mergulho 06:C5, 15/10/2026): só o nome, o telefone e os
 * endereços de entrega, que é o que o cardápio usa para "reconhecer pelo WhatsApp". Antes saía o cadastro inteiro
 * (documento, e-mail, grupo, empresa...) para quem digitasse o telefone.
 */
export function clientePublico(client: any) {
    if (!client) return null
    const enderecos = (client.addresses || [])
        // Endereços fantasmas de retirada não aparecem
        .filter((a: any) => !a.street?.toLowerCase().includes('retirada') && !a.neighborhood?.toLowerCase().includes('balcão'))
        .map((a: any) => ({
            id: a.id,
            street: a.street,
            number: a.number,
            neighborhood: a.neighborhood,
            city: a.city,
            state: a.state,
            zipcode: a.zipcode,
            complement: a.complement,
            is_main: a.is_main,
        }))
    return { name: client.name, phone: client.phone, addresses: enderecos }
}
