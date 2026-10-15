import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { sseManager, bancoDaRequisicao } from '@/lib/sse-manager'
import { intervaloDoDiaOperacional } from '@/lib/dia-operacional'
import {
    arredondar2,
    centavos,
    compararComNavegador,
    conferirItens,
    nomeProvisorio,
    normalizar,
    situacaoDaLoja,
    taxaDeEntrega,
    type ItemConferido,
} from '../../services/pedido-online-regras'
import { carregarCatalogoDoPedido } from '../../services/pedido-online-catalogo'

/** Telefone só com dígitos, sem o 55 do país. */
function telefoneLimpo(bruto: string): string {
    let digitos = (bruto || '').replace(/\D/g, '')
    if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.substring(2)
    return digitos
}

/** Assinatura dos itens para a trava contra pedido repetido (06:C8): mesmo produto, quantidade e preço. */
function assinaturaDosItens(itens: { produto_id?: string | null; quantidade: number; valor_unitario: number }[]): string {
    return itens
        .map((i) => `${i.produto_id ?? ''}|${Number(i.quantidade)}|${centavos(i.valor_unitario)}`)
        .sort()
        .join(';')
}

/** Nome do item no aviso ao vivo para o PDV, montado com o cadastro (não com o texto do navegador). */
function nomeDoItemConferido(c: ItemConferido, meiaPorcao: boolean): string {
    if (c.sabores.length > 1) return c.sabores.map((s) => `1/${c.sabores.length} ${s}`).join(' + ')
    return meiaPorcao ? `${c.produto.name} (1/2 porção)` : c.produto.name
}

export async function createOnlineOrder(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    const createOnlineOrderSchema = z.object({
        uuid: z.string().uuid().nullable().optional(),
        display_id: z.union([z.number(), z.string()]).nullable().optional().transform(v => v !== undefined && v !== null && v !== '' ? Number(v) : undefined),
        origin: z.string().nullable().optional().default('Delivery').transform(v => v || 'Delivery'),
        isTakeout: z.boolean().nullable().optional(),
        status_delivery: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        client_name: z.string().nullable().optional().default('Cliente Delivery').transform(v => v || 'Cliente Delivery'),
        client_phone: z.string().nullable().optional().default('00000000000').transform(v => v || '00000000000'),
        // Código do cliente (o mesmo no PDV e na nuvem), mandado pelo PDV novo (02:P3)
        client_id: z.string().uuid().nullable().optional(),
        street: z.string().nullable().optional().default('').transform(v => v || ''),
        number: z.union([z.string(), z.number()]).nullable().optional().transform(v => v !== undefined && v !== null ? String(v).trim() : ''),
        neighborhood: z.string().nullable().optional().default('').transform(v => v || ''),
        city: z.string().nullable().optional().default('').transform(v => v || ''),
        state: z.string().nullable().optional().default('').transform(v => v || ''),
        zipcode: z.union([z.string(), z.number()]).nullable().optional().transform(v => v !== undefined && v !== null ? String(v) : undefined),
        complement: z.string().nullable().optional().transform(v => v || undefined),
        reference: z.string().nullable().optional().transform(v => v || undefined),
        payment_method_id: z.string().nullable().optional().transform(v => v || undefined),
        payment_method_name: z.string().nullable().optional().default('Dinheiro').transform(v => v || 'Dinheiro'),
        change_for: z.union([z.number(), z.string()]).nullable().optional().transform(v => v !== undefined && v !== null && v !== '' ? Number(v) : undefined),
        delivery_fee: z.union([z.number(), z.string()]).nullable().optional().default(0).transform(v => v !== undefined && v !== null && v !== '' ? Number(v) : 0),
        total_amount: z.union([z.number(), z.string()]).nullable().optional().default(0).transform(v => v !== undefined && v !== null && v !== '' ? Number(v) : 0),
        notes: z.string().nullable().optional().transform(v => v || undefined),
        items: z.array(z.object({
            product_id: z.string().nullable().optional().transform(v => v || undefined),
            name: z.string().nullable().optional().default('Item').transform(v => v || 'Item'),
            quantity: z.union([z.number(), z.string()]).nullable().optional().default(1).transform(v => v !== undefined && v !== null && v !== '' ? Number(v) : 1),
            unit_price: z.union([z.number(), z.string()]).nullable().optional().default(0).transform(v => v !== undefined && v !== null && v !== '' ? Number(v) : 0),
            unit_cost: z.union([z.number(), z.string()]).nullable().optional().default(0).transform(v => v !== undefined && v !== null && v !== '' ? Number(v) : 0),
            notes: z.string().nullable().optional().transform(v => v || undefined),
            complements: z.any().nullable().optional(),
            fractions: z.any().nullable().optional(),
            // Cardápio do Marujo: meia porção (65% do preço), ver services/pedido-online-regras.ts
            meia_porcao: z.boolean().nullable().optional()
        })).nullable().optional().default([]).transform(v => v || [])
    })

    const body = createOnlineOrderSchema.parse(request.body)

    // Mergulho (06:C4, 06:C6, 15/10/2026): só o PDV (rota /api/pdv/orders com origem "PDV") manda um pedido já
    // conferido no caixa, com preço e desconto do operador. Todo o resto é o cardápio online (ou alguém imitando
    // ele) e passa pela conferência da nuvem: loja aberta, nome e WhatsApp, taxa do bairro e preço do cadastro.
    // A rota do PDV continua sem chave porque o PDV 2.5.53 não manda nenhuma (fechar isso é a troca de chaves da Fase 0).
    const caminho = (request.url || '').split('?')[0]
    const pedidoDoPdv = caminho.startsWith('/api/pdv/') && body.origin === 'PDV'
    const doCardapio = !pedidoDoPdv
    const corpoBruto = (request.body || {}) as Record<string, unknown>
    const tenant = requestContext.get('tenant')

    try {
        // Reenvio do mesmo pedido (internet caiu depois de gravar): devolve o que já existe, antes de qualquer conferência
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

        const isPdvOrigin = body.origin === 'PDV' || body.origin === 'Mesa' || body.origin === 'Balcao' || body.origin === 'Balcão'
        const isTakeout =
            (body.origin === 'Balcão' || body.origin === 'Balcao') ||
            (body.street || '').toLowerCase().includes('retirada') ||
            (body.neighborhood || '').toLowerCase().includes('balcão') ||
            (Boolean(body.notes) && body.notes!.toLowerCase().includes('retirada')) ||
            (!isPdvOrigin && (!body.street || !body.neighborhood))

        let resolvedDeliveryFee = isPdvOrigin ? body.delivery_fee : (isTakeout ? 0 : body.delivery_fee)

        const companyProfile = await prisma.companyProfile.findFirst({ include: { businessHours: true } })

        // Conta conferida pela nuvem (só no pedido do cardápio)
        let conferidos: ItemConferido[] = []
        let subtotalConferido = 0
        let totalConferido = 0

        if (doCardapio) {
            // 06:C4: a loja tem de estar aberta (pausa manual e horário do dia, com folga de 15 min depois de fechar)
            const situacao = situacaoDaLoja(companyProfile)
            if (!situacao.aberta) {
                request.log.warn({ tenant, motivo: situacao.motivo }, '[Cardápio] Pedido recusado: loja fechada')
                return reply.status(409).send({
                    code: 'LOJA_FECHADA',
                    message: `${situacao.motivo} O pedido não foi enviado.`
                })
            }

            // 06:C2: sem nome e WhatsApp a loja não consegue falar com o cliente (o cardápio já exige os dois)
            const nomeInformado = typeof corpoBruto.client_name === 'string' ? corpoBruto.client_name.trim() : ''
            const foneInformado = telefoneLimpo(typeof corpoBruto.client_phone === 'string' ? corpoBruto.client_phone : '')
            if (!nomeInformado || foneInformado.length < 10 || foneInformado.length > 11 || /^0+$/.test(foneInformado)) {
                return reply.status(400).send({
                    code: 'CLIENTE_INCOMPLETO',
                    message: 'Informe o seu nome e o WhatsApp com DDD para a loja poder falar com você.'
                })
            }

            if (body.items.length === 0) {
                return reply.status(400).send({ code: 'CARRINHO_VAZIO', message: 'O carrinho está vazio.' })
            }

            // Taxa de entrega: a mesma que o cardápio mostrou para o bairro (setor ou taxa padrão)
            if (isTakeout) {
                resolvedDeliveryFee = 0
            } else {
                const entrega = taxaDeEntrega(companyProfile, body.neighborhood)
                if (!entrega.atendido) {
                    // Mesmo texto de antes: o cardápio reconhece "bairro"/"área de entrega" e leva o cliente ao WhatsApp
                    return reply.status(400).send({
                        message: `Desculpe, o bairro "${body.neighborhood}" não está na área de entrega atendida pela loja.`
                    })
                }
                resolvedDeliveryFee = entrega.taxa
            }

            // 06:C6: preço de cada item refeito com o cadastro (produto, sabores, complementos e "N grátis")
            const catalogo = await carregarCatalogoDoPedido(prisma, body.items)
            const conferencia = conferirItens(body.items, catalogo)
            if (conferencia.problemas.some((p) => p.tipo === 'quantidade_invalida')) {
                return reply.status(400).send({ code: 'QUANTIDADE_INVALIDA', message: 'Quantidade inválida em um item do carrinho.' })
            }
            if (conferencia.problemas.length > 0) {
                request.log.warn(
                    { tenant, caminho, problemas: conferencia.problemas.map((p) => p.detalhe) },
                    '[Cardápio] Pedido recusado: item do carrinho não confere com o cadastro'
                )
                return reply.status(409).send({
                    code: 'ITEM_INDISPONIVEL',
                    message: 'Algum item do seu carrinho mudou ou saiu do cardápio. Atualize a página e monte o pedido de novo.',
                    problemas: conferencia.problemas.map((p) => ({ index: p.indice, detalhe: p.detalhe }))
                })
            }

            const conta = compararComNavegador(conferencia.itens, resolvedDeliveryFee, body, !isTakeout)
            if (conta.divergencias.length > 0) {
                // Registra antes de recusar: preço mudado no painel com o cardápio aberto, ou requisição mexida.
                // O cardápio novo atualiza o carrinho com os valores abaixo e o cliente confirma de novo; nada fica travado.
                request.log.warn(
                    { tenant, caminho, divergencias: conta.divergencias, totalNavegador: body.total_amount, totalCadastro: conta.total },
                    '[Cardápio] Pedido recusado: preço divergente do cadastro'
                )
                return reply.status(409).send({
                    code: 'PRECO_DIVERGENTE',
                    message: 'Os preços do cardápio mudaram desde que você abriu a página. Atualize a página para ver os valores de hoje e faça o pedido de novo.',
                    itens: conferencia.itens.map((c) => ({ index: c.indice, product_id: c.produto.id, unit_price: c.unitarioNuvem })),
                    subtotal: conta.subtotal,
                    delivery_fee: conta.taxa,
                    total_amount: conta.total
                })
            }

            // Pedido mínimo (o cardápio já bloqueia; aqui vale para quem chamar a rota direto)
            const minimo = Number(companyProfile?.minOrderValue || 0)
            if (minimo > 0 && centavos(conta.subtotal) < centavos(minimo)) {
                return reply.status(400).send({
                    code: 'PEDIDO_MINIMO',
                    message: `O pedido mínimo da loja é de R$ ${minimo.toFixed(2).replace('.', ',')} (sem a taxa de entrega).`
                })
            }

            conferidos = conferencia.itens
            subtotalConferido = conta.subtotal
            totalConferido = conta.total
            resolvedDeliveryFee = conta.taxa
        }

        const cleanPhone = telefoneLimpo(body.client_phone)

        const phoneVariants = [cleanPhone, body.client_phone]
        if (cleanPhone.length === 11 && cleanPhone[2] === '9') {
            phoneVariants.push(cleanPhone.slice(0, 2) + cleanPhone.slice(3))
            phoneVariants.push(cleanPhone.slice(0, 10))
        } else if (cleanPhone.length === 10) {
            phoneVariants.push(cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2))
        }

        // Fase 2 do Mergulho (02:P3): pedido sem telefone (o PDV manda "00000000000") não junta clientes diferentes num só. O
        // PDV novo manda o código do cliente (o mesmo nos dois lados); sem ele, só reaproveita o cliente desse telefone que
        // tem o MESMO nome. Antes todo pedido sem telefone caía no primeiro cliente "00000000000". (O pedido do cardápio
        // nunca chega aqui sem telefone: 06:C2 recusa antes.)
        const semTelefone = /^0*$/.test(cleanPhone)
        // O código do cliente só vale para o PDV: no cardápio, quem soubesse o código pegaria o cadastro de outro (06:C5)
        let client = pedidoDoPdv && body.client_id
            ? await prisma.client.findUnique({ where: { id: body.client_id }, include: { addresses: true } })
            : null
        if (!client) {
            client = await prisma.client.findFirst({
                where: semTelefone
                    ? { phone: { in: Array.from(new Set(phoneVariants)) }, name: { equals: body.client_name, mode: 'insensitive' } }
                    : { phone: { in: Array.from(new Set(phoneVariants)) } },
                include: {
                    addresses: true
                }
            })
        }

        let targetAddressId: string | null = null
        const norm = (s?: string | null) => normalizar(s)
        // Nome digitado diferente do cadastro: vai na observação do pedido, sem trocar o cadastro (06:C5)
        let nomeNoPedido: string | null = null

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
            const dadosDoCliente: { phone?: string; name?: string } = {}
            if (!semTelefone && cleanPhone.length === 11 && (client.phone || '').length !== 11) {
                dadosDoCliente.phone = cleanPhone
            }
            if (doCardapio && norm(client.name) !== norm(body.client_name)) {
                // 06:C5: quem sabe o telefone de alguém não troca mais o nome do cadastro dele. Só o nome provisório
                // ("Cliente Delivery", número) vira o nome digitado; senão o nome digitado vai na observação.
                if (nomeProvisorio(client.name)) dadosDoCliente.name = body.client_name.trim()
                else nomeNoPedido = body.client_name.trim()
            }
            if (Object.keys(dadosDoCliente).length > 0) {
                await prisma.client.update({
                    where: { id: client.id },
                    data: dadosDoCliente
                })
                if (dadosDoCliente.name) client.name = dadosDoCliente.name
            }

            // Para Retirada, NUNCA criamos endereço!
            if (!isTakeout && body.street && body.neighborhood) {
                // 06:C5: no pedido do cardápio o endereço só é reaproveitado se for igual em tudo (rua, número, bairro e
                // complemento); senão vira um endereço novo, sem mexer nos que já existem. O pedido leva o que o cliente digitou.
                const matchingAddr = client.addresses?.find(a =>
                    norm(a.street) === norm(body.street) &&
                    norm(a.number) === norm(body.number) &&
                    (!doCardapio || (norm(a.neighborhood) === norm(body.neighborhood) && norm(a.complement) === norm(body.complement)))
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
                    client.addresses = [...(client.addresses || []), newAddr]
                    targetAddressId = newAddr.id
                }
            }
        }

        // Itens que vão para o banco: no cardápio, com o preço do cadastro; no PDV, como o caixa mandou
        const itensParaGravar = doCardapio
            ? conferidos.map((c) => {
                const original = body.items[c.indice]
                const observacao = [
                    c.sabores.length > 1 ? `Sabores: ${nomeDoItemConferido(c, false)}` : null,
                    original.meia_porcao ? '1/2 porção' : null,
                    original.notes ? original.notes.trim() : null
                ].filter(Boolean).join(' | ')
                return {
                    produto_id: c.produto.id,
                    quantidade: c.quantidade,
                    valor_unitario: c.unitarioNuvem,
                    valor_total: arredondar2(c.unitarioNuvem * c.quantidade),
                    observacao: observacao || null,
                    complementos_json: c.complementos.length > 0
                        ? JSON.stringify(c.complementos.map((x) => ({ name: x.name, price: x.price, quantity: x.quantity, option_id: x.option_id, group_id: x.group_id })))
                        : null
                }
            })
            : body.items.map(item => {
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
        const nomesParaAviso = doCardapio
            ? conferidos.map((c) => nomeDoItemConferido(c, Boolean(body.items[c.indice]?.meia_porcao)))
            : body.items.map((i) => i.name)
        const valorFinal = doCardapio ? totalConferido : body.total_amount

        // Trava contra pedido repetido (toque duplo, reenvio). Com uuid (cardápio novo e PDV) o reenvio já foi tratado
        // lá em cima e dois pedidos iguais de verdade entram os dois; pedido sem telefone nunca é "repetição" (02:P3). Sem
        // uuid (cardápio aberto antes desta versão), só é repetido se for o mesmo cliente, endereço, valor e itens em
        // 2 minutos (06:C8: antes bastava o mesmo valor).
        if (!body.uuid && !semTelefone) {
            const recentDuplicateWindow = new Date(Date.now() - 2 * 60 * 1000)
            const recentes = await prisma.pedido.findMany({
                where: {
                    cliente_id: client.id,
                    valor_final: valorFinal,
                    data_abertura: { gte: recentDuplicateWindow }
                },
                include: { itens: true },
                orderBy: { data_abertura: 'desc' },
                take: 5
            })
            const assinaturaNova = assinaturaDosItens(itensParaGravar)
            const existingRecentOrder = recentes.find(p =>
                (p.endereco_entrega_id ?? null) === (targetAddressId ?? null) &&
                assinaturaDosItens(p.itens) === assinaturaNova
            )

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
        }

        // Número do dia: conta desde as 05:00 de Brasília (dia operacional), não desde a meia-noite
        const today = intervaloDoDiaOperacional().inicio
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
            nomeNoPedido ? 'Nome no pedido: ' + nomeNoPedido : null,
            body.reference ? 'Ref: ' + body.reference : null,
            body.notes ? 'Obs: ' + body.notes : null
        ].filter(Boolean).join(' | ')

        const subtotal = doCardapio ? subtotalConferido : Math.max(0, body.total_amount - resolvedDeliveryFee)

        const activeCashier = await prisma.cashierSession.findFirst({
            where: { status: 'OPEN' },
            orderBy: { opened_at: 'desc' }
        })

        const pedido = await prisma.pedido.create({
            data: {
                uuid: body.uuid || undefined,
                // O cardápio não escolhe número nem situação do pedido: isso é do caixa
                display_id: (pedidoDoPdv && body.display_id) || displayId,
                numero_diario: (pedidoDoPdv && body.display_id) || displayId,
                origem: isTakeout ? 'Balcão' : (body.origin || 'Delivery'),
                caixa_id: activeCashier?.id || null,
                cliente_id: client.id,
                endereco_entrega_id: targetAddressId,
                subtotal: subtotal,
                valor_frete: resolvedDeliveryFee,
                valor_final: valorFinal,
                valor_troco: body.change_for || 0,
                status: (pedidoDoPdv && body.status) || 'Aberto',
                status_delivery: (pedidoDoPdv && body.status_delivery) || 'Pendente',
                observacao: fullObservations,
                sincronizado_web: true,
                itens: {
                    create: itensParaGravar
                }
            },
            include: {
                itens: true
            }
        })

        // Notifica via SSE
        try {
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
                    name: nomesParaAviso[idx] || i.observacao || 'Item',
                    quantity: i.quantidade,
                    price: i.valor_unitario,
                    observation: i.observacao,
                    complements: i.complementos_json ? JSON.parse(i.complementos_json) : []
                }))
            }

            sseManager.notifyTenant(bancoDaRequisicao(), 'new_order', fullOrderDto)
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
