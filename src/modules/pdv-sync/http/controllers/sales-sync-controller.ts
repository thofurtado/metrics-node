import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { buildItemCost } from '../../services/item-cost-loader'
import {
    SyncRejection,
    buildSaleEntries,
    checkSaleSession,
    chooseSaleSessionId,
    clientTabDescription,
    desiredClientTabs,
    paymentKind,
    planClientTabs,
    plataformaDaVenda,
    plataformaMudou,
    saleEntryTag,
    saleFieldsChanged,
    sameEntries,
    type PaymentKind,
} from '../../services/cashier-sync-rules'
import { metodoNaConferencia } from '../../services/pagamentos-do-pdv'
import {
    camposDoItem,
    camposNovosDoItemSchema,
    camposQueFaltam,
    funcionarioDoVendedor,
    gravarNotaFiscal,
    notaFiscalSchema,
    temVendedor,
} from '../../services/dados-da-venda'
import { baixarItemVendido, carregarItemDaBaixa, planejarBaixa } from '@/modules/stock/services/baixa-da-venda'

/**
 * O operador escolheu "Registrar como desperdício" ao cancelar este item (o cancelamento sobe antes da venda no ciclo do PDV).
 * Vale para a venda cancelada que ainda não estava na nuvem: sem isso a saída do produto que foi para o lixo se perdia.
 */
async function foiDesperdicio(tx: Prisma.TransactionClient, saleItemId: string): Promise<boolean> {
    const registro = await tx.cancellationAudit.findFirst({
        where: { item_id: saleItemId, stock_destination: 'DESPERDICIO' },
        select: { id: true },
    })
    return !!registro
}

export async function postSalesSync(request: FastifyRequest, reply: FastifyReply) {
    const saleSchema = z.array(z.object({
        Uuid: z.string().uuid(),
        CashierSessionId: z.string().uuid().optional().nullable(),
        Origin: z.string().optional().default('PDV'),
        TotalAmount: z.number().min(0),
        Subtotal: z.number().optional().default(0),
        Discount: z.number().optional().default(0),
        ValorCouvert: z.number().optional().default(0),
        ValorServico: z.number().optional().default(0),
        ValorFrete: z.number().optional().default(0),
        ClienteUuid: z.string().uuid().optional().nullable(),
        // Mesa ou comanda de onde a venda veio ("Mesa 07"), para relatório por mesa
        OriginIdentifier: z.string().optional().nullable(),
        Status: z.string().default('COMPLETED'),
        CreatedAt: z.string().optional(),
        // Pedido do iFood/99 (PDV novo, 15/10/2026): de qual plataforma é a venda ("IFOOD", "99FOOD") e se a entrega foi da
        // loja, mesmo paga em dinheiro: a conferência lança a comissão. Sem os campos (PDV antigo), nada muda.
        PlataformaCodigo: z.string().max(40).optional().nullable(),
        EntregaPropria: z.boolean().optional().nullable(),
        // NFC-e da venda (Vendas, etapa 1, 16/10/2026): situação, número, série, ambiente e chave. Sem o campo (PDV antigo),
        // a venda fica sem os dados da nota ("—" na web), como antes.
        NotaFiscal: notaFiscalSchema.optional().nullable(),
        Payments: z.array(z.object({
            PaymentMethodUuid: z.string().uuid().optional().nullable(),
            Method: z.string(),
            Amount: z.number().min(0),
            PosMachineName: z.string().optional().nullable(),
            ClienteId: z.string().uuid().optional().nullable(),
            ColaboradorId: z.string().uuid().optional().nullable(),
            NomeTitular: z.string().optional().nullable(),
            Parcelas: z.number().optional().default(1),
            // PRAZO ou FUNCIONARIO (PDV 2.5.23 em diante): a mesma regra que exige o cliente ou o funcionário na tela do PDV
            Tipo: z.string().optional().nullable(),
            // PDV 2.5.24 em diante: categoria da forma (Dinheiro, Pix, Debito, Credito, Voucher, CreditoLoja), o identificador
            // (Correntista, Funcionário, Permuta) e a maquininha, pelos códigos da web
            Categoria: z.string().optional().nullable(),
            IdentificadorUuid: z.string().uuid().optional().nullable(),
            PosMachineUuid: z.string().uuid().optional().nullable(),
        })).optional().default([]),
        Items: z.array(z.object({
            Uuid: z.string().uuid(),
            ProductId: z.string().optional().nullable(),
            Quantity: z.number().positive(),
            UnitPrice: z.number().min(0),
            UnitCost: z.number().optional().default(0),
            // Custo dos complementos por unidade do item, somado pelo PDV (usado só se não vier a lista)
            ComplementsCost: z.number().optional().nullable(),
            Discount: z.number().optional().default(0),
            Observation: z.string().optional().nullable(),
            Fractions: z.array(z.object({
                ProductId: z.string(),
                Fraction: z.number().positive().max(1),
                Cost: z.number().optional().nullable(),
            })).optional(),
            Complements: z.array(z.object({
                OptionId: z.string().optional().nullable(),
                LinkedSupplyId: z.string().optional().nullable(),
                Price: z.number().min(0).optional().default(0),
                Name: z.string().optional().nullable(),
                Quantity: z.number().positive().optional().default(1),
                Cost: z.number().optional().nullable(),
            })).optional(),
            // Como o item foi vendido (Vendas, etapa 1): nome, vendedor, complementos escolhidos e observação livre. Opcionais.
            ...camposNovosDoItemSchema,
        })),
    }))

    const sales = saleSchema.parse(request.body)

    // Cada pagamento com o nome do caixa da web e a maquininha com o nome que está na web hoje (10/10/2026). Antes ia o nome do
    // PDV ("Cartão de Crédito", "Vale Refeição (VR/Sodexo/Alelo)") e a conferência, que procura pelos nomes da web, não achava a
    // taxa nem o prazo de recebimento da maquininha.
    const identificadores = new Map<string, string>()
    // Plataforma do identificador (o "iFood" da forma "Pago na plataforma"), para a venda que não diz a plataforma
    const plataformaDoIdentificador = new Map<string, string | null>()
    const maquininhas = new Map<string, string>()
    const metodoDoPagamento = new WeakMap<object, string>()
    for (const sale of sales) {
        for (const pay of sale.Payments) {
            if (pay.IdentificadorUuid) identificadores.set(pay.IdentificadorUuid, '')
            if (pay.PosMachineUuid) maquininhas.set(pay.PosMachineUuid, '')
        }
    }
    if (identificadores.size > 0) {
        for (const i of await prisma.paymentIdentifier.findMany({ where: { id: { in: [...identificadores.keys()] } }, select: { id: true, name: true, platform: { select: { code: true } } } })) {
            identificadores.set(i.id, i.name)
            plataformaDoIdentificador.set(i.id, i.platform?.code ?? null)
        }
    }
    if (maquininhas.size > 0) {
        for (const m of await prisma.pOSMachine.findMany({ where: { id: { in: [...maquininhas.keys()] } }, select: { id: true, name: true } })) {
            maquininhas.set(m.id, m.name)
        }
    }
    for (const sale of sales) {
        for (const pay of sale.Payments) {
            const nomeDoIdentificador = pay.IdentificadorUuid ? identificadores.get(pay.IdentificadorUuid) : null
            const nomeDaMaquininha = pay.PosMachineUuid ? maquininhas.get(pay.PosMachineUuid) : null
            metodoDoPagamento.set(pay, metodoNaConferencia(pay, nomeDoIdentificador))
            if (nomeDaMaquininha) pay.PosMachineName = nomeDaMaquininha
        }
    }

    // Funcionário do RH de cada vendedor (Vendas, etapa 1): uma consulta por vendedor no envio
    const funcionarios = new Map<string, string | null>()
    type ItemDaVenda = (typeof sales)[number]['Items'][number]
    type Cliente = Prisma.TransactionClient
    const funcionarioDoItem = (tx: Cliente, item: ItemDaVenda) =>
        temVendedor(item) ? funcionarioDoVendedor(tx, item.VendedorId, funcionarios) : Promise.resolve(null)
    // Item que já está na nuvem (venda do PDV antigo reenviada pelo novo): completa só o que falta, nunca troca o gravado.
    // Não mexe em dinheiro nem em estoque, então vale também em caixa conferido.
    const completarItem = async (tx: Cliente, item: ItemDaVenda, guardado: Parameters<typeof camposQueFaltam>[0]) => {
        const novos = camposDoItem(item, guardado.seller_employee_id == null ? await funcionarioDoItem(tx, item) : null)
        const faltam = camposQueFaltam(guardado, novos)
        if (Object.keys(faltam).length > 0) await tx.saleItem.update({ where: { id: item.Uuid }, data: faltam })
    }

    try {
        await prisma.$transaction(async (tx) => {
        for (const sale of sales) {
            // 1. Caixa da venda (regras em services/cashier-sync-rules.ts): a nuvem nunca escolhe um caixa por conta própria.
            //    Antes, venda de caixa fechado (ou sem caixa) caía no caixa aberto mais recente de QUALQUER terminal.
            const existingSale = await tx.sale.findUnique({
                where: { id: sale.Uuid },
                select: { cashier_session_id: true, total_amount: true, discount: true, status: true, origin: true }
            })
            const targetSessionId = chooseSaleSessionId(sale.CashierSessionId, existingSale?.cashier_session_id)
            const session = targetSessionId
                ? await tx.cashierSession.findUnique({ where: { id: targetSessionId }, select: { status: true } })
                : null

            // 2. O que a venda muda: lançamentos (um por pagamento), valores/status e itens novos.
            const desiredEntries = buildSaleEntries(sale.Uuid, sale.Origin, sale.Status,
                sale.Payments.map(p => ({ Method: metodoDoPagamento.get(p) ?? p.Method, Amount: p.Amount })))
            const storedEntries = session && targetSessionId
                ? await tx.cashierEntry.findMany({
                    where: {
                        cashier_session_id: targetSessionId, type: 'SALE', source: 'PDV',
                        // Pela venda (coluna sale_id, desde 2.6.89) ou, para lançamento antigo, pelo texto
                        OR: [{ sale_id: sale.Uuid }, { sale_id: null, identification: { contains: saleEntryTag(sale.Uuid) } }],
                    },
                    select: { id: true, identification: true, payment_method: true, amount: true, platform_code: true, platform_own_delivery: true }
                })
                : []
            const plataforma = plataformaDaVenda(sale, sale.Payments.map(p => (p.IdentificadorUuid ? plataformaDoIdentificador.get(p.IdentificadorUuid) : null)))
            const entriesChanged = !sameEntries(
                storedEntries.map(e => ({ identification: e.identification ?? '', payment_method: e.payment_method, amount: e.amount })),
                desiredEntries,
            )
            const storedItems = new Map((await tx.saleItem.findMany({
                where: { id: { in: sale.Items.map(i => i.Uuid) } },
                select: { id: true, sold_name: true, seller_employee_id: true, seller_name: true, seller_number: true, complements: true, note: true }
            })).map(i => [i.id, i]))
            const hasNewItems = sale.Items.some(i => !storedItems.has(i.Uuid))
            const changesSession = !existingSale || saleFieldsChanged(existingSale, sale) || entriesChanged || hasNewItems

            const rejection = checkSaleSession(targetSessionId, session, changesSession)
            if (rejection) throw new SyncRejection(rejection, sale.Uuid)

            // Origem, mesa e taxas não mexem em dinheiro: completam a venda antiga até em caixa conferido
            const detalhes = {
                origin: sale.Origin || null,
                origin_identifier: sale.OriginIdentifier || null,
                delivery_fee: sale.ValorFrete ?? 0,
                service_fee: sale.ValorServico ?? 0,
                cover_charge: sale.ValorCouvert ?? 0,
            }
            if (!changesSession) {
                if (existingSale && existingSale.origin === null) {
                    await tx.sale.update({ where: { id: sale.Uuid }, data: detalhes })
                }
                // A plataforma chegou depois (PDV atualizado reenviando): completa os lançamentos, menos em caixa conferido
                // (a conferência já lançou o financeiro; desfazer e conferir de novo pega a plataforma)
                if (session && session.status !== 'CHECKED' && plataformaMudou(storedEntries, plataforma)) {
                    await tx.cashierEntry.updateMany({ where: { id: { in: storedEntries.map(e => e.id) } }, data: plataforma! })
                }
                // A nota que mudou depois (emitida pelo F9, contingência autorizada, cancelada) e os dados do item que faltam:
                // não mexem em dinheiro, então completam a venda até em caixa conferido (Vendas, etapa 1)
                if (sale.NotaFiscal) await gravarNotaFiscal(tx, sale.Uuid, sale.NotaFiscal)
                for (const item of sale.Items) {
                    const guardado = storedItems.get(item.Uuid)
                    if (guardado) await completarItem(tx, item, guardado)
                }
                continue // reenvio idêntico: nada mais a gravar
            }

            const saleCreatedAt = sale.CreatedAt ? new Date(sale.CreatedAt) : new Date()

            // Pagamentos positivos, na mesma ordem dos lançamentos desejados (cliente e colaborador conferidos antes de gravar).
            // Desde 10/10/2026 o cliente só vai no lançamento do FIADO: na conferência, lançamento com cliente = conta a prazo, e
            // antes o Pix ou o dinheiro de uma venda com cliente identificado (delivery, CPF) virava "a prazo" desse cliente.
            const positivePayments = sale.Status === 'CANCELLED' ? [] : sale.Payments.filter(p => p.Amount > 0)
            const paymentLinks: { clientId: string | null; employeeId: string | null; kind: PaymentKind }[] = []
            for (const pay of positivePayments) {
                const kind = paymentKind(pay)
                let clientId: string | null = null
                if (kind === 'PRAZO') {
                    const wantedClientId = pay.ClienteId || sale.ClienteUuid || null
                    const clientExists = wantedClientId
                        ? !!(await tx.client.findUnique({ where: { id: wantedClientId }, select: { id: true } }))
                        : false
                    // Fiado sem o cliente na nuvem perderia a conta a receber: recusa até o cadastro do cliente subir.
                    if (wantedClientId && !clientExists) throw new SyncRejection('CLIENTE_NAO_ENVIADO', sale.Uuid)
                    clientId = clientExists ? wantedClientId : null
                }

                // O colaborador é o funcionário do RH; o PDV pode mandar o usuário do sistema ligado a um funcionário (a nuvem
                // acha o funcionário por ele). Usuário que não é funcionário: recusa, senão o vale se perderia.
                let employeeId: string | null = null
                if (pay.ColaboradorId) {
                    const employee = await tx.employee.findFirst({
                        where: { OR: [{ id: pay.ColaboradorId }, { user_id: pay.ColaboradorId }] },
                        select: { id: true },
                    })
                    if (!employee) throw new SyncRejection('FUNCIONARIO_NAO_ENCONTRADO', sale.Uuid)
                    employeeId = employee.id
                }
                paymentLinks.push({ clientId, employeeId, kind })
            }

            // 3. Venda: o caixa de uma venda que já existe nunca muda.
            await tx.sale.upsert({
                where: { id: sale.Uuid },
                update: {
                    total_amount: sale.TotalAmount,
                    discount: sale.Discount,
                    status: sale.Status,
                    cashier_session_id: targetSessionId,
                    ...detalhes,
                },
                create: {
                    id: sale.Uuid,
                    total_amount: sale.TotalAmount,
                    discount: sale.Discount,
                    status: sale.Status,
                    cashier_session_id: targetSessionId,
                    created_at: saleCreatedAt,
                    ...detalhes,
                }
            })
            // NFC-e da venda (Vendas, etapa 1): a mesma regra da rota da nota (a mudança mais velha não passa por cima da nova)
            if (sale.NotaFiscal) await gravarNotaFiscal(tx, sale.Uuid, sale.NotaFiscal)

            // 4. Lançamentos de caixa da venda: só no caixa DELA. Se mudaram (pagamento alterado, cancelamento), troca todos;
            //    antes, trocar a forma com um pagamento não chegava à nuvem e com vários pagamentos duplicava.
            if (entriesChanged) {
                if (storedEntries.length > 0) {
                    await tx.cashierEntry.deleteMany({ where: { id: { in: storedEntries.map(e => e.id) } } })
                }
                for (let i = 0; i < desiredEntries.length; i++) {
                    const entry = desiredEntries[i]
                    await tx.cashierEntry.create({
                        data: {
                            cashier_session_id: targetSessionId!,
                            origin: sale.Origin || 'PDV',
                            payment_method: entry.payment_method,
                            amount: entry.amount,
                            type: 'SALE',
                            identification: entry.identification,
                            source: 'PDV',
                            sale_id: sale.Uuid,
                            // Maquininha da venda: a conferência usa para achar a taxa e o banco de destino
                            bank: positivePayments[i]?.PosMachineName || null,
                            client_id: paymentLinks[i]?.clientId ?? null,
                            employee_id: paymentLinks[i]?.employeeId ?? null,
                            // Pedido do iFood/99: a plataforma e quem entregou (a conferência lança a comissão)
                            platform_code: plataforma?.platform_code ?? null,
                            platform_own_delivery: plataforma?.platform_own_delivery ?? null,
                            created_at: saleCreatedAt
                        }
                    })
                }
            } else if (plataformaMudou(storedEntries, plataforma)) {
                await tx.cashierEntry.updateMany({ where: { id: { in: storedEntries.map(e => e.id) } }, data: plataforma! })
            }

            // 5. Fiado: a conta do cliente acompanha a venda (decisão de 25/09: é o registro oficial do fiado). Venda nova abre a
            //    conta; troca de pagamento muda o valor ou o cliente; cancelamento tira o que ainda não foi pago. Parte já paga
            //    nunca é mexida. Antes a conta só era criada: venda cancelada continuava devendo e o saldo voltava ao PDV.
            //    O consumo de funcionário NÃO vira vale aqui: o vale nasce num lugar só, na conferência do caixa (antes nascia
            //    aqui e de novo na conferência, e o funcionário seria descontado em dobro).
            // Fase 2 do Mergulho (02:P7): a conta é ligada à venda pelos 8 primeiros caracteres do código ("Pedido #1f9408ee"),
            // e duas vendas podem começar igual. Agora só vale a conta do caixa DA venda (é onde ela sempre é criada, e a
            // baixa parcial na web copia o caixa): antes, mexer numa venda podia apagar ou mudar o a prazo de outra.
            const storedTabs = await tx.clientTab.findMany({
                where: { description: { contains: saleEntryTag(sale.Uuid) }, cashier_session_id: targetSessionId },
                select: { id: true, client_id: true, amount: true, is_paid: true },
            })
            const tabPlan = planClientTabs(storedTabs, desiredClientTabs(sale.Status, positivePayments.map((pay, i) => ({
                amount: pay.Amount,
                clientId: paymentLinks[i].clientId,
                kind: paymentLinks[i].kind,
                holderName: pay.NomeTitular,
            }))))
            if (tabPlan.remove.length > 0) {
                await tx.clientTab.deleteMany({ where: { id: { in: tabPlan.remove }, is_paid: false } })
            }
            for (const u of tabPlan.update) {
                await tx.clientTab.update({ where: { id: u.id }, data: { amount: u.amount } })
            }
            for (const c of tabPlan.create) {
                await tx.clientTab.create({
                    data: {
                        client_id: c.clientId,
                        cashier_session_id: targetSessionId,
                        amount: c.amount,
                        description: clientTabDescription(sale.Uuid, c.holderName),
                        is_paid: false,
                        created_at: saleCreatedAt,
                    }
                })
            }

            // 6. Processar Itens da Venda e Motor de Baixa de Insumos da Ficha Técnica
            for (const item of sale.Items) {
                const existingItem = await tx.saleItem.findUnique({
                    where: { id: item.Uuid }
                })

                // Valida se o produto existe no banco da nuvem para não violar FK sale_items_product_id_fkey
                let validProductId: string | null = null
                if (item.ProductId) {
                    const prodExists = await tx.product.findUnique({
                        where: { id: item.ProductId },
                        select: { id: true }
                    })
                    if (prodExists) {
                        validProductId = prodExists.id
                    }
                }

                if (existingItem) {
                    await completarItem(tx, item, existingItem)
                } else {
                    // Custo congelado do item: usa o que o PDV congelou na venda e completa o que faltar pelo cadastro
                    const cost = await buildItemCost(tx, item)

                    await tx.saleItem.create({
                        data: {
                            id: item.Uuid,
                            sale_id: sale.Uuid,
                            product_id: validProductId,
                            quantity: item.Quantity,
                            unit_price: item.UnitPrice,
                            discount: item.Discount,
                            unit_cost: cost.unit_cost,
                            complements_cost: cost.complements_cost,
                            cost_source: cost.source,
                            cost_snapshot: cost.snapshot as unknown as Prisma.InputJsonValue,
                            // Nome como vendido, vendedor, complementos e observação (Vendas, etapa 1); PDV antigo: nada
                            ...camposDoItem(item, await funcionarioDoItem(tx, item)),
                        }
                    })

                    // Baixa do estoque (regra D8 do Thomás, 16/10/2026, em stock/services/baixa-da-venda.ts): ficha técnica baixa
                    // os insumos, complemento com insumo baixa o insumo, produto sem ficha baixa ele mesmo; cada linha guarda o
                    // saldo logo depois. Venda cancelada só baixa quando o operador escolheu "desperdício" no cancelamento que
                    // chegou antes dela (venda cancelada que ainda não tinha subido, decisão de 28/09/2026): a saída fica e o
                    // histórico mostra como perda. Nunca trava: o saldo pode ficar negativo (D5).
                    if (sale.Status === 'COMPLETED' || (sale.Status === 'CANCELLED' && await foiDesperdicio(tx, item.Uuid))) {
                        const plano = planejarBaixa(await carregarItemDaBaixa(tx, item, cost.unit_cost))
                        await baixarItemVendido(tx, plano, { saleItemId: item.Uuid, criadoEm: saleCreatedAt })
                    }
                }
            }
        }
        }, { timeout: 30000, maxWait: 10000 })
    } catch (err) {
        // Recusa com motivo (409): o PDV isola a venda, tenta de novo com espera e mostra o motivo em "Estado da sincronia".
        if (err instanceof SyncRejection) return reply.status(409).send(err.toResponse())
        throw err
    }

    // Fase 4 do Mergulho (02:P11): diz quais vendas foram aceitas, como os cancelamentos e os movimentos de caixa. Hoje o lote
    // é tudo ou nada (uma recusa desfaz o lote inteiro com 409), então são todas; o PDV novo só marca como enviadas as que
    // estiverem aqui, e nada se perde se um dia a nuvem passar a pular uma venda.
    // notaFiscal: esta nuvem guarda a NFC-e e os dados do item (Vendas, etapa 1). O PDV só dá a nota por entregue quando vê isto;
    // com a nuvem antiga, ele manda a nota de novo pela rota própria quando a nuvem for atualizada.
    return reply.status(201).send({ message: 'Vendas e baixas de CMV sincronizadas com sucesso', accepted: sales.map(s => s.Uuid), notaFiscal: true })
}
