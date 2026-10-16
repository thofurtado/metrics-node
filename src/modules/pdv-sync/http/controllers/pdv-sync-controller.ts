import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Product, StockReason } from '@prisma/client'
import { codigoDoMovimento, splitStockMovements } from '../../services/stock-movement-rules'
import { acceptsChanges, saleEntryTag, shouldReverseStock } from '../../services/cashier-sync-rules'
import { funcionarioEntraNoPdv, funcionarioInativo, funcionarioInativoParaPdv, funcionarioParaConsumo, funcionarioParaPdv, usuarioParaPdv } from '../../services/equipe-do-pdv'
import { categoriasDaMaquininha, tipoDoIdentificador } from '../../services/pagamentos-do-pdv'
import { hash } from 'bcryptjs'
import { fiscaisLimpos, cstIcmsValido, csosnValido, cfopValido, cfopCoerente, ncmValido, cestValido, cstPisCofinsValido, codigoBarrasValido } from '@/lib/codigos-fiscais'
import { COBERTURA_MINIMA_DO_ESPELHO, INICIO_FAIXA_AFASTADOS, mesmoProduto, planoDoEspelho } from '../../services/codigo-do-sistema-da-loja'
import { randomBytes } from 'node:crypto'

export async function getProductsSync(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        lastSync: z.string().datetime().optional()
    })
    
    const { lastSync } = querySchema.parse(request.query)

    const products = await prisma.product.findMany({
        where: lastSync ? {
            updated_at: { gt: new Date(lastSync) }
        } : {
            active: true
        },
        // Na ordem em que mudaram (16/10/2026): o PDV ainda acha produto pelo NOME quando não conhece o id. Com a ordem, a cópia
        // desativada pelo espelho (antes) chega antes do produto certo de mesmo nome criado pelo envio (depois), e o produto
        // certo não é trocado pela cópia no PDV
        orderBy: { updated_at: 'asc' },
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            active: true,
            category_id: true,
            display_id: true,
            updated_at: true,
            image_url: true,
            measureUnit: true,
            barcode: true,
            ncm: true,
            cest: true,
            cfop: true,
            csosn: true,
            cst_icms: true,
            origem: true,
            cst_pis: true,
            aliquota_pis: true,
            cst_cofins: true,
            aliquota_cofins: true,
            is_priority: true,
            category: {
                select: {
                    name: true
                }
            }
        }
    })

    // Mapear para o formato que o C# espera:
    // Uuid, Name, Description, Price, Active, CategoryId, Id (display_id se for numero, ou algo similar)
    const formatted = products.map(p => ({
        Uuid: p.id,
        Id: p.display_id,
        Name: p.name,
        Description: p.description,
        Price: p.price,
        Active: p.active,
        CategoryId: p.category_id,
        CategoryName: p.category?.name || "Geral",
        UpdatedAt: p.updated_at,
        ImageUrl: p.image_url,
        // UNITARY ou FRACTIONAL (por peso): o Caixa do PDV pede a quantidade em kg com vírgula (06/10/2026)
        MeasureUnit: p.measureUnit,
        // Regra (Thomás, 09/10/2026): o PDV recebe TODOS os produtos ativos completos; o cardápio online só os marcados
        // "Cardápio". Antes o código de barras e os dados fiscais só chegavam ao PDV pelo cardápio, e os produtos fora dele
        // (1.751 na Katatau) ficavam sem código de barras, sem NCM e com o código errado.
        ...(() => {
            const f = fiscaisLimpos(p)
            return {
                Barcode: f.barcode, Ncm: f.ncm, Cest: f.cest, Cfop: f.cfop, Csosn: f.csosn, CstIcms: f.cst_icms, Origem: f.origem,
                CstPis: f.cst_pis, AliquotaPis: p.aliquota_pis, CstCofins: f.cst_cofins, AliquotaCofins: p.aliquota_cofins,
            }
        })(),
        IsPriority: p.is_priority
    }))

    return reply.status(200).send(formatted)
}

export async function getUsersSync(request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            password_hash: true,
            pin_hash: true,
            role: true,
            created_at: true
        }
    })

    // Funcionários do RH que o grupo libera para o PDV e/ou o app do garçom (etapa 1.5, 06/10/2026). Só para o PDV que
    // pede (2.5.8 em diante): o PDV antigo não sabe separar "só o app do garçom" e mostraria o garçom no login do caixa.
    // Desde 10/10/2026 vão TODOS os funcionários ativos: quem não entra em nada vai sem PIN e sem acesso, só para o consumo e
    // o vale (decisão de 25/09: a mesma lista do RH da web); o usuário ligado a um funcionário vai marcado como funcionário.
    const { incluirFuncionarios, incluirInativos } = (request.query ?? {}) as { incluirFuncionarios?: string; incluirInativos?: string }
    let usuariosFuncionarios = new Set<string>()
    if (incluirFuncionarios === '1') {
        try {
            const ligados = await prisma.employee.findMany({
                where: { isRegistered: true, user_id: { not: null } },
                select: { user_id: true },
            })
            usuariosFuncionarios = new Set(ligados.map(l => l.user_id!))
        } catch (err) {
            request.log.warn({ err }, '[pdv-sync] usuários ligados a funcionários não lidos')
        }
    }

    const formatted = users.map(u => usuarioParaPdv(u, usuariosFuncionarios.has(u.id)))

    if (incluirFuncionarios === '1') {
        try {
            const funcionarios = await prisma.employee.findMany({
                where: { isRegistered: true, user_id: null },
                select: {
                    id: true, name: true, pin: true, isRegistered: true, user_id: true, created_at: true,
                    group: { select: { name: true, can_use_waiter_app: true, can_use_pdv: true } },
                },
            })
            const protegerTexto = (texto: string) => hash(texto, 6)
            const segredoAleatorio = () => randomBytes(24).toString('hex')
            for (const f of funcionarios) {
                formatted.push(funcionarioEntraNoPdv(f)
                    ? await funcionarioParaPdv(f, protegerTexto, segredoAleatorio)
                    : await funcionarioParaConsumo(f, protegerTexto, segredoAleatorio))
            }
        } catch (err) {
            // Banco desta loja ainda sem os grupos (sincronização pendente no SaaS Admin): vão só os usuários, como antes
            request.log.warn({ err }, '[pdv-sync] funcionários fora da lista de usuários (grupos ainda não criados neste banco)')
        }
    }

    // Número do vendedor pela ordem de cadastro (16/10/2026): o PDV 2.5.58 em diante pede também os funcionários INATIVOS,
    // com a data de cadastro, para o número de cada um nunca mudar (o inativo não vende, mas guarda o número dele).
    if (incluirFuncionarios === '1' && incluirInativos === '1') {
        try {
            const inativos = await prisma.employee.findMany({
                where: { isRegistered: false, user_id: null },
                select: {
                    id: true, name: true, pin: true, isRegistered: true, user_id: true, created_at: true,
                    group: { select: { name: true, can_use_waiter_app: true, can_use_pdv: true } },
                },
            })
            const protegerTexto = (texto: string) => hash(texto, 6)
            const segredoAleatorio = () => randomBytes(24).toString('hex')
            for (const f of inativos) {
                if (funcionarioInativoParaPdv(f)) formatted.push(await funcionarioInativo(f, protegerTexto, segredoAleatorio))
            }
        } catch (err) {
            request.log.warn({ err }, '[pdv-sync] funcionários inativos fora da lista de usuários')
        }
    }

    return reply.status(200).send(formatted)
}

export async function getClientsSync(request: FastifyRequest, reply: FastifyReply) {
    const clients = await prisma.client.findMany({
        include: {
            addresses: {
                where: { is_main: true }
            },
            clientTabs: {
                where: { is_paid: false }
            }
        }
    })

    const formatted = clients.map(c => {
        const saldoDevedor = c.clientTabs ? c.clientTabs.reduce((acc, tab) => acc + (tab.amount || 0), 0) : 0
        return {
            Uuid: c.id,
            Name: c.name,
            Identification: c.identification, // CpfCnpj no C#
            Email: c.email,
            Phone: c.phone, // Telefone no C#
            CreatedAt: c.created_at,
            SaldoDevedor: saldoDevedor,
            Address: c.addresses.length > 0 ? {
                Street: c.addresses[0].street,
                Number: c.addresses[0].number,
                Neighborhood: c.addresses[0].neighborhood,
                City: c.addresses[0].city,
                State: c.addresses[0].state,
                Zipcode: c.addresses[0].zipcode,
                Complement: c.addresses[0].complement
            } : null
        }
    })

    return reply.status(200).send(formatted)
}

export async function postClientsSync(request: FastifyRequest, reply: FastifyReply) {
    const clientsSchema = z.array(
        z.object({
            Uuid: z.string().uuid(),
            Name: z.string(),
            Identification: z.string().nullable().optional(),
            Email: z.string().nullable().optional(),
            Phone: z.string().nullable().optional(),
            CreatedAt: z.string().datetime().optional(),
            Address: z.object({
                Street: z.string(),
                Number: z.string(),
                Neighborhood: z.string(),
                City: z.string(),
                State: z.string(),
                Zipcode: z.string().nullable().optional(),
                Complement: z.string().nullable().optional()
            }).nullable().optional()
        })
    )

    const parsedClients = clientsSchema.parse(request.body)
    // Telefone de mentira ("00000000000", que o PDV antigo grava no cliente sem telefone) vira "sem telefone" (10/10/2026)
    const telefoneDeVerdade = (fone: string | null | undefined) => {
        const digitos = (fone ?? '').replace(/\D/g, '')
        return digitos.length > 0 && !/^0+$/.test(digitos) ? fone!.trim() : null
    }

    for (const c of parsedClients) {
        // Upsert no client
        await prisma.client.upsert({
            where: { id: c.Uuid },
            update: {
                name: c.Name,
                identification: c.Identification || null,
                email: c.Email || null,
                phone: telefoneDeVerdade(c.Phone)
            },
            create: {
                id: c.Uuid,
                name: c.Name,
                identification: c.Identification || null,
                email: c.Email || null,
                phone: telefoneDeVerdade(c.Phone),
                created_at: c.CreatedAt ? new Date(c.CreatedAt) : new Date()
            }
        })

        // Se veio endereço, vamos fazer um upsert tbm, marcando como is_main
        if (c.Address) {
            // Buscamos se o cliente já tem um endereço principal
            const mainAddr = await prisma.address.findFirst({
                where: { client_id: c.Uuid, is_main: true }
            })

            if (mainAddr) {
                await prisma.address.update({
                    where: { id: mainAddr.id },
                    data: {
                        street: c.Address.Street,
                        number: c.Address.Number,
                        neighborhood: c.Address.Neighborhood,
                        city: c.Address.City,
                        state: c.Address.State,
                        zipcode: c.Address.Zipcode || null,
                        complement: c.Address.Complement || null
                    }
                })
            } else {
                await prisma.address.create({
                    data: {
                        client_id: c.Uuid,
                        street: c.Address.Street,
                        number: c.Address.Number,
                        neighborhood: c.Address.Neighborhood,
                        city: c.Address.City,
                        state: c.Address.State,
                        zipcode: c.Address.Zipcode || null,
                        complement: c.Address.Complement || null,
                        is_main: true
                    }
                })
            }
        }
    }

    return reply.status(201).send({ message: 'Clientes sincronizados com sucesso' })
}

export async function postStocksSync(request: FastifyRequest, reply: FastifyReply) {
    const stockMovementSchema = z.array(
        z.object({
            // Código do movimento no PDV (PDV novo, 02:P4): reenvio do mesmo movimento não mexe no estoque de novo
            uuid: z.string().uuid().optional().nullable(),
            productId: z.union([z.string().uuid(), z.number()]), // backend agora aceita UUID ou Int
            quantity: z.number(),
            type: z.enum(['IN', 'OUT']),
            // Texto livre: um motivo desconhecido não pode derrubar o lote inteiro (ver stock-movement-rules.ts)
            reason: z.string().optional().default('VENDA'),
            createdAt: z.string().datetime().optional()
        })
    )

    const allMovements = stockMovementSchema.parse(request.body)

    // B0-02: a saída "VENDA" já é feita pelo recebimento da venda; aceitar esta também baixaria o estoque duas vezes.
    const { accepted: movements, ignoredSales, ignoredUnknown } = splitStockMovements(allMovements)
    if (ignoredUnknown.length > 0) {
        console.warn(`[Sync] ${ignoredUnknown.length} movimentação(ões) de estoque com motivo desconhecido ignorada(s).`)
    }

    // Fase 2 do Mergulho (02:P4): cada movimento tem código (o do PDV ou um calculado do conteúdo) e a linha de estoque e o
    // saldo do produto mudam juntos (transação). Reenvio do mesmo movimento é reconhecido e não mexe no estoque de novo.
    // "accepted" = o que o PDV pode marcar como enviado (aplicado agora, já aplicado antes ou ignorado pela regra).
    const accepted: string[] = []
    const ignored: { uuid: string; reason: string }[] = []
    for (const mov of [...ignoredSales, ...ignoredUnknown]) {
        if (mov.uuid) accepted.push(mov.uuid)
    }
    let applied = 0
    let repeated = 0

    for (const mov of movements) {
        // Encontra o UUID do produto usando id ou display_id
        const product = await prisma.product.findFirst({
            where: typeof mov.productId === 'string' 
                ? { id: mov.productId }
                : { display_id: mov.productId }
        })

        if (!product) {
            console.warn(`[Sync] Produto com identificador ${mov.productId} não encontrado.`)
            if (mov.uuid) ignored.push({ uuid: mov.uuid, reason: 'PRODUTO_NAO_ENCONTRADO' })
            continue // Skip se não achar, para não travar os outros
        }

        const codigo = codigoDoMovimento(mov)
        if (codigo && await prisma.stock.findUnique({ where: { id: codigo }, select: { id: true } })) {
            repeated++
            if (mov.uuid) accepted.push(mov.uuid)
            continue
        }

        try {
            await prisma.$transaction([
                prisma.stock.create({
                    data: {
                        ...(codigo ? { id: codigo } : {}),
                        product_id: product.id,
                        quantity: mov.quantity,
                        operation: mov.type,
                        description: mov.reason as StockReason, // só chegam aqui motivos de APPLICABLE_REASONS
                        created_at: mov.createdAt ? new Date(mov.createdAt) : new Date()
                    }
                }),
                // Atualiza o saldo do produto
                prisma.product.update({
                    where: { id: product.id },
                    data: {
                        stock: mov.type === 'IN' 
                            ? { increment: mov.quantity } 
                            : { decrement: mov.quantity }
                    }
                }),
            ])
            applied++
        } catch (err: any) {
            // Dois envios do mesmo movimento ao mesmo tempo: o segundo bate no código repetido e não mexe no estoque
            if (err?.code === 'P2002') { repeated++ } else { throw err }
        }
        if (mov.uuid) accepted.push(mov.uuid)
    }

    return reply.status(201).send({
        message: 'Movimentações sincronizadas com sucesso',
        applied,
        repeated,
        ignored_sales: ignoredSales.length,
        ignored_unknown: ignoredUnknown.length,
        accepted,
        ignored,
    })
}

export async function getSyncStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
        const maxUser = await prisma.user.aggregate({
            _max: { updated_at: true }
        })

        const maxProduct = await prisma.product.aggregate({
            _max: { updated_at: true }
        })

        const maxClient = await prisma.client.aggregate({
            _max: { updated_at: true }
        })

        const totalProducts = await prisma.product.count({
            where: { active: true }
        })

        const lastUserModified = maxUser._max.updated_at || new Date(0)
        const lastProductModified = maxProduct._max.updated_at || new Date(0)
        const lastClientModified = maxClient._max.updated_at || new Date(0)

        return reply.status(200).send({
            lastUserModified: lastUserModified.toISOString(),
            lastProductModified: lastProductModified.toISOString(),
            lastClientModified: lastClientModified.toISOString(),
            totalProducts
        })
    } catch (error: any) {
        console.error('[Sync] Erro ao obter status de sincronização:', error)
        return reply.status(500).send({
            message: 'Erro ao processar status de sincronização',
            details: error.message
        })
    }
}

export async function getEmployeesSync(request: FastifyRequest, reply: FastifyReply) {
    try {
        const employees = await prisma.employee.findMany({
            select: {
                id: true,
                name: true,
                role: true,
                pin: true,
                allow_term_sales: true,
                term_credit_limit: true
            }
        })

        const formatted = employees.map(e => ({
            Uuid: e.id,
            Name: e.name,
            Role: e.role,
            Pin: e.pin,
            PermiteVendaPrazo: e.allow_term_sales,
            LimiteCredito: Number(e.term_credit_limit || 0)
        }))

        return reply.status(200).send(formatted)
    } catch (err: any) {
        if (err?.code === 'P2022' || err?.message?.includes('allow_term_sales')) {
            const employees = await prisma.employee.findMany({
                select: {
                    id: true,
                    name: true,
                    role: true,
                    pin: true
                }
            })
            const formatted = employees.map(e => ({
                Uuid: e.id,
                Name: e.name,
                Role: e.role,
                Pin: e.pin,
                PermiteVendaPrazo: false,
                LimiteCredito: 0
            }))
            return reply.status(200).send(formatted)
        }
        throw err
    }
}

export async function getPrintDepartmentsSync(request: FastifyRequest, reply: FastifyReply) {
    const departments = await prisma.printDepartment.findMany({
        include: {
            products: true
        }
    })

    const formatted = departments.map(d => ({
        Uuid: d.id,
        Name: d.name,
        ProductUuids: d.products.map(p => p.product_id),
        CreatedAt: d.created_at,
        UpdatedAt: d.updated_at
    }))

    return reply.status(200).send(formatted)
}


export async function getPaymentsSync(request: FastifyRequest, reply: FastifyReply) {
    const payments = await prisma.payment.findMany({ where: { active: true, active_for_in: true } })
    const formatted = payments.map(p => ({
        Uuid: p.id,
        Name: p.name,
        InstallmentLimit: p.installment_limit,
        InSight: p.in_sight,
        AccountId: p.account_id,
        Active: p.active,
        SefazTpag: p.sefaz_tPag,
        // Tipo da forma (15/10/2026): "PLATAFORMA" = paga no app do iFood/99 (o PDV usa no despacho do pago no app); null = comum
        Kind: p.kind ?? null,
        CreatedAt: p.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getPaymentIdentifiersSync(request: FastifyRequest, reply: FastifyReply) {
    const identifiers = await prisma.paymentIdentifier.findMany({ where: { active: true }, include: { platform: { select: { code: true } } } })
    // "Type" no formato do PDV (10/10/2026): o PDV lê o tipo por esse campo, que não vinha, e os identificadores da web
    // chegavam vazios e nunca apareciam no PDV. Nome sem espaço sobrando ("Correntista " na Katatau).
    const formatted = identifiers.map(i => ({
        Uuid: i.id,
        Name: i.name.trim(),
        Type: tipoDoIdentificador(i),
        IsCorrentistaDebt: i.is_correntista_debt,
        IsStockEvasion: i.is_stock_evasion,
        PaymentMethodId: i.payment_method_id,
        Active: i.active,
        // Plataforma do identificador da forma "Pago na plataforma" (15/10/2026): "IFOOD", "99FOOD" ou null
        PlatformCode: i.platform?.code ?? null,
        CreatedAt: i.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getPaymentConditionsSync(request: FastifyRequest, reply: FastifyReply) {
    const conditions = await prisma.paymentCondition.findMany({ where: { active: true } })
    const formatted = conditions.map(c => ({
        Uuid: c.id,
        Name: c.name,
        Installments: c.installments,
        Active: c.active,
        CreatedAt: c.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getPOSMachinesSync(request: FastifyRequest, reply: FastifyReply) {
    const machines = await prisma.pOSMachine.findMany({ where: { active: true }, include: { rates: { select: { payment_category: true } } } })
    // O que cada maquininha aceita, pelas taxas cadastradas na web (10/10/2026): o PDV só pergunta pelas maquininhas daquela
    // forma (e escolhe sozinho quando só uma aceita). Sem taxa cadastrada = vale para todo cartão, como antes.
    const formatted = machines.map(m => ({
        Uuid: m.id,
        Name: m.name,
        AccountId: m.account_id,
        Active: m.active,
        Categorias: categoriasDaMaquininha(m.rates),
        CreatedAt: m.created_at
    }))
    return reply.status(200).send(formatted)
}

export async function getSystemConfigSync(request: FastifyRequest, reply: FastifyReply) {
    try {
        let config = await prisma.systemConfig.findFirst({
            select: {
                blind_cashier_closure: true,
                cashier_default_origin: true,
            }
        })
        if (!config) {
            config = await prisma.systemConfig.create({
                data: {},
                select: {
                    blind_cashier_closure: true,
                    cashier_default_origin: true,
                }
            })
        }
        return reply.status(200).send({
            BlindCashierClosure: config?.blind_cashier_closure ?? false,
            CashierDefaultOrigin: config?.cashier_default_origin ?? 'Mesa'
        })
    } catch (err: any) {
        console.warn('[PDV Sync] Fallback seguro ao ler systemConfig:', err.message)
        return reply.status(200).send({
            BlindCashierClosure: false,
            CashierDefaultOrigin: 'Mesa'
        })
    }
}


/**
 * Produto em uso: com venda no PDV (sale_items), item de pedido do cardápio/iFood/99 (pedido_itens) ou vínculo com item de
 * plataforma (delivery_item_mappings). Vendas e pedidos guardam só o id do produto, não o nome: renomear um produto em uso
 * para OUTRO produto mudaria o nome no histórico (e o vínculo do iFood passaria a apontar o produto errado).
 */
async function produtoEmUso(productId: string): Promise<boolean> {
    const [vendas, pedidos, vinculos] = await Promise.all([
        prisma.saleItem.count({ where: { product_id: productId } }),
        prisma.pedidoItem.count({ where: { produto_id: productId } }),
        prisma.deliveryItemMapping.count({ where: { product_id: productId } }),
    ])
    return vendas + pedidos + vinculos > 0
}

/**
 * Envio em lote do Sync (sistema antigo da loja -> nuvem).
 *
 * Com o código do sistema da loja (displayId; no Athos, o idproduto), O CÓDIGO MANDA (16/10/2026, Katatau): o produto é o
 * que tem esse display_id. Existe: atualiza (nome, código de barras, preço, custo, categoria, ativo...). Não existe: cria com
 * esse código. Antes a nuvem procurava pelo nome ou pelo código de barras e mudava códigos (faixa 900.000 e o "conflito" do
 * Mergulho 07:S5); o produto que estava num código que não é do Athos agora é desativado pelo espelho (postProductsEspelhoSync).
 * - O nome que chegou é de OUTRO produto (ver mesmoProduto; aqui só o nome conta, porque é o nome que o histórico mostra) e o
 *   produto do código já foi usado: o antigo sai do código (faixa 900.000, inativo, com o histórico e o nome de quando foi
 *   vendido) e nasce um produto novo no código.
 * - OUTRO produto e nunca usado (nem o nome nem o código de barras batem): o mesmo registro passa a ser o produto do Athos com
 *   os dados do Athos, como um produto novo (código de barras, descrição, fiscais, estoque; a foto sai), para não herdar nada
 *   do produto errado. Mesmo código de barras = o mesmo cadastro com o nome mudado.
 * - O MESMO produto: atualiza como sempre; CSOSN/CFOP já preenchidos na nuvem ficam (nuvem 2.6.127.0).
 * Sem displayId (outros sistemas): procura pelo nome ou pelo código de barras, como antes.
 *
 * Estoque (16/10/2026, Katatau): a loja vende pelo Metrics e o saldo da nuvem é baixado pelas vendas; o do Athos fica parado.
 * Produto que já existe NÃO recebe o estoque do sistema da loja (nem conta como mudança); só o produto novo nasce com ele.
 * `estoqueDoSistemaDaLoja: true` no corpo (opção do Sync, por loja) volta ao comportamento antigo.
 */
export async function postProductsBulkSync(request: FastifyRequest, reply: FastifyReply) {
    const bulkSchema = z.object({
        estoqueDoSistemaDaLoja: z.boolean().nullable().optional(),
        products: z.array(
            z.object({
                externalId: z.string().nullable().optional(),
                displayId: z.number().int().positive().nullable().optional(),
                name: z.string(),
                price: z.number(),
                cost: z.number().nullable().optional(),
                barcode: z.string().nullable().optional(),
                ncm: z.string().nullable().optional(),
                cest: z.string().nullable().optional(),
                cfop: z.string().nullable().optional(),
                csosn: z.string().nullable().optional(),
                cstIcms: z.string().nullable().optional(),
                origem: z.number().nullable().optional(),
                cstPis: z.string().nullable().optional(),
                aliquotaPis: z.number().nullable().optional(),
                cstCofins: z.string().nullable().optional(),
                aliquotaCofins: z.number().nullable().optional(),
                categoryName: z.string().nullable().optional(),
                subcategoryName: z.string().nullable().optional(),
                active: z.boolean().nullable().optional(),
                stock: z.number().nullable().optional(),
                description: z.string().nullable().optional()
            })
        )
    })

    const { products, estoqueDoSistemaDaLoja } = bulkSchema.parse(request.body)
    const estoqueDaLojaVale = estoqueDoSistemaDaLoja === true

    let created = 0
    let updated = 0
    let unchanged = 0

    const maxDisplay = await prisma.product.aggregate({
        _max: { display_id: true }
    })
    let currentMaxDisplayId = maxDisplay._max.display_id ?? 0
    // Mudou o nome no código: de que produto para qual (outroProduto = não é o mesmo produto renomeado; ver mesmoProduto)
    const renomeados: { codigo: number; de: string; para: string; outroProduto: boolean }[] = []
    // Produto já usado que deu lugar ao produto do Athos no código (ficou inativo na faixa 900.000, com o histórico)
    const substituidos: { codigo: number; produtoAntigo: string; codigoDoAntigo: number; produtoNovo: string }[] = []

    for (const p of products) {
        if (!p.name || !p.name.trim()) continue

        const name = p.name.trim()
        const catName = p.categoryName?.trim()

        // 1. Categoria e Subcategoria (find or create)
        let categoryId: string | null = null
        let subcategoryId: string | null = null
        if (catName) {
            let category = await prisma.category.findUnique({
                where: { name: catName }
            })
            if (!category) {
                category = await prisma.category.create({
                    data: { name: catName }
                })
            }
            categoryId = category.id

            if (p.subcategoryName?.trim()) {
                const subName = p.subcategoryName.trim()
                let subcategory = await prisma.subcategory.findFirst({
                    where: { name: subName, category_id: categoryId }
                })
                if (!subcategory) {
                    subcategory = await prisma.subcategory.create({
                        data: {
                            name: subName,
                            category_id: categoryId
                        }
                    })
                }
                subcategoryId = subcategory.id
            }
        }

        // 2. O produto: pelo código do sistema da loja (o código manda); sem código, pelo nome ou pelo código de barras
        let existing: Product | null
        let outroProduto = false
        if (p.displayId) {
            existing = await prisma.product.findUnique({ where: { display_id: p.displayId } })
            // O NOME decide o histórico (as vendas guardam só o id do produto); o código de barras só ajuda a reconhecer o
            // mesmo cadastro em produto nunca usado. Katatau: o 3022 "MOUSSE GRANDE UNID" (1 venda) tem o código de barras
            // do Snickers do Athos e não pode virar "SNICKERS MOUSSE" na venda dele
            if (existing && !mesmoProduto(existing.name, null, name, null)) {
                if (await produtoEmUso(existing.id)) {
                    // Já vendido/usado: o antigo sai do código com o histórico e nasce um produto novo no código
                    currentMaxDisplayId = Math.max(currentMaxDisplayId, INICIO_FAIXA_AFASTADOS) + 1
                    await prisma.product.update({
                        where: { id: existing.id },
                        data: { display_id: currentMaxDisplayId, active: false, updated_at: new Date() }
                    })
                    substituidos.push({ codigo: p.displayId, produtoAntigo: existing.name, codigoDoAntigo: currentMaxDisplayId, produtoNovo: name })
                    existing = null
                } else if (!mesmoProduto(existing.name, existing.barcode, name, p.barcode)) {
                    // Nunca usado e nem o código de barras bate: é outro produto (com o mesmo código de barras é o mesmo
                    // cadastro com o nome mudado, ex.: "SABAO ASSIM NEUTRO 800 G" -> "900 G", e fica o fiscal revisado)
                    outroProduto = true
                }
            }
        } else {
            existing = await prisma.product.findFirst({
                where: {
                    OR: [
                        { name: { equals: name, mode: 'insensitive' } },
                        ...(p.barcode && p.barcode.trim() ? [{ barcode: p.barcode.trim() }] : [])
                    ]
                }
            })
        }

        if (existing) {
            const estoqueMudou = (outroProduto || estoqueDaLojaVale) && p.stock !== undefined && p.stock !== null && existing.stock !== p.stock
            const hasChanged =
                outroProduto ||
                existing.name !== name ||
                existing.price !== p.price ||
                (p.cost !== undefined && p.cost !== null && existing.cost !== p.cost) ||
                estoqueMudou ||
                (p.active !== undefined && p.active !== null && existing.active !== p.active) ||
                (categoryId && existing.category_id !== categoryId) ||
                (p.barcode && existing.barcode !== p.barcode.trim()) ||
                (p.description && existing.description !== p.description)

            if (hasChanged) {
                if (existing.name !== name && p.displayId) renomeados.push({ codigo: p.displayId, de: existing.name, para: name, outroProduto })
                // OUTRO produto no código (nunca usado): os dados são os do sistema da loja, como num produto novo
                const doSistema = outroProduto
                await prisma.product.update({
                    where: { id: existing.id },
                    data: {
                        name,
                        price: p.price,
                        cost: p.cost !== undefined && p.cost !== null ? p.cost : (doSistema ? 0 : existing.cost),
                        // Estoque de produto que já existe: o saldo é o da nuvem (baixado pelas vendas); fora do update para não
                        // gravar por cima de uma venda que baixou o saldo enquanto o lote rodava
                        ...(doSistema || estoqueDaLojaVale
                            ? { stock: p.stock !== undefined && p.stock !== null ? p.stock : (doSistema ? 0 : existing.stock) }
                            : {}),
                        // Código fiscal fora do formato não entra; o que já está gravado fica (a limpeza é na saída): ver lib/codigos-fiscais.ts
                        barcode: doSistema ? codigoBarrasValido(p.barcode) : codigoBarrasValido(p.barcode) ?? existing.barcode,
                        ncm: doSistema ? ncmValido(p.ncm) : ncmValido(p.ncm) ?? existing.ncm,
                        cest: doSistema ? cestValido(p.cest) : cestValido(p.cest) ?? existing.cest,
                        // CSOSN e CFOP já preenchidos na nuvem ficam (16/10/2026, Katatau): o cadastro fiscal foi revisado na
                        // nuvem e o Athos mandava combinações erradas a cada mudança de preço. Vazio na nuvem = vem do sistema
                        // da loja, já acertado (cfopCoerente). Para mudar depois: web, Produtos › Fiscal. Outro produto no
                        // código: o revisado era do produto errado, então vale o do sistema da loja (acertado).
                        cfop: doSistema
                            ? cfopCoerente(csosnValido(p.csosn), cfopValido(p.cfop))
                            : existing.cfop ?? cfopCoerente(existing.csosn ?? csosnValido(p.csosn), cfopValido(p.cfop)),
                        csosn: doSistema ? csosnValido(p.csosn) : existing.csosn ?? csosnValido(p.csosn),
                        cst_icms: doSistema ? cstIcmsValido(p.cstIcms) : cstIcmsValido(p.cstIcms) ?? existing.cst_icms,
                        origem: p.origem !== undefined && p.origem !== null ? p.origem : (doSistema ? 0 : existing.origem),
                        cst_pis: doSistema ? cstPisCofinsValido(p.cstPis) : cstPisCofinsValido(p.cstPis) ?? existing.cst_pis,
                        aliquota_pis: p.aliquotaPis !== undefined && p.aliquotaPis !== null ? p.aliquotaPis : (doSistema ? 0 : existing.aliquota_pis),
                        cst_cofins: doSistema ? cstPisCofinsValido(p.cstCofins) : cstPisCofinsValido(p.cstCofins) ?? existing.cst_cofins,
                        aliquota_cofins: p.aliquotaCofins !== undefined && p.aliquotaCofins !== null ? p.aliquotaCofins : (doSistema ? 0 : existing.aliquota_cofins),
                        category_id: categoryId ?? existing.category_id,
                        subcategory_id: doSistema ? subcategoryId : subcategoryId ?? existing.subcategory_id,
                        active: p.active !== undefined && p.active !== null ? p.active : (doSistema ? true : existing.active),
                        description: p.description !== undefined && p.description !== null ? p.description : (doSistema ? null : existing.description),
                        // A foto era do produto errado (o sistema da loja não manda foto)
                        ...(doSistema ? { image_url: null } : {}),
                        updated_at: new Date()
                    }
                })
                updated++
            } else {
                unchanged++
            }
        } else {
            let targetDisplayId: number
            if (p.displayId) {
                // O código está livre (não havia produto, ou o produto usado acabou de sair dele)
                targetDisplayId = p.displayId
            } else {
                currentMaxDisplayId++
                targetDisplayId = currentMaxDisplayId
            }

            currentMaxDisplayId = Math.max(currentMaxDisplayId, targetDisplayId)

            await prisma.product.create({
                data: {
                    name,
                    price: p.price,
                    cost: p.cost ?? 0,
                    stock: p.stock ?? 0,
                    min_stock: 0,
                    barcode: codigoBarrasValido(p.barcode),
                    ncm: ncmValido(p.ncm),
                    cest: cestValido(p.cest),
                    cfop: cfopCoerente(csosnValido(p.csosn), cfopValido(p.cfop)),
                    csosn: csosnValido(p.csosn),
                    cst_icms: cstIcmsValido(p.cstIcms),
                    origem: p.origem ?? 0,
                    cst_pis: cstPisCofinsValido(p.cstPis),
                    aliquota_pis: p.aliquotaPis ?? 0,
                    cst_cofins: cstPisCofinsValido(p.cstCofins),
                    aliquota_cofins: p.aliquotaCofins ?? 0,
                    category_id: categoryId,
                    subcategory_id: subcategoryId,
                    active: p.active !== undefined && p.active !== null ? p.active : true,
                    description: p.description || null,
                    display_id: targetDisplayId
                }
            })
            created++
        }
    }

    if (substituidos.length > 0 || renomeados.length > 0) {
        request.log.warn({ substituidos, renomeados }, '[Sync] Produtos que mudaram de nome pelo código do sistema da loja')
    }

    const outros = renomeados.filter((r) => r.outroProduto).length
    return reply.status(200).send({
        created,
        updated,
        unchanged,
        renomeados,
        substituidos,
        message: `Sincronização de produtos realizada com sucesso! (${created} criados, ${updated} atualizados, ${unchanged} inalterados).`
            + (renomeados.length > 0 ? ` ${renomeados.length} produto(s) mudaram de nome pelo código do sistema da loja${outros > 0 ? ` (${outros} eram outro produto, nunca vendido)` : ''}.` : '')
            + (substituidos.length > 0 ? ` ${substituidos.length} produto(s) já vendidos estavam no código de outro produto do sistema da loja: ficaram inativos na faixa 900.000 com o histórico, e o código ganhou um produto novo: ${substituidos.slice(0, 5).map((s) => `${s.codigo} (${s.produtoAntigo} -> ${s.produtoNovo})`).join('; ')}${substituidos.length > 5 ? '...' : ''}.` : '')
    })
}

/**
 * Espelho do sistema da loja (16/10/2026, Katatau: "não pode haver produto a mais"). O Sync manda a lista COMPLETA dos
 * códigos do Athos (ativos e inativos); produto ATIVO da nuvem cujo código não está na lista, ou está inativo no Athos, vai
 * para inativo com updated_at agora (o PDV e o cardápio deixam de mostrar). Nunca apaga (as vendas apontam para o produto e o
 * PDV só enxerga o que muda por updated_at) e nunca ativa (quem ativa é o envio do produto).
 * - Trava: se a lista tem o código de menos de 80% dos produtos ativos da nuvem, recusa (HTTP 409) e explica: o Athos pode
 *   ter sido lido pela metade, ou é o banco errado. Lista vazia também é recusada.
 * - `simular: true` devolve o que mudaria, sem gravar nada.
 * - A nuvem não guarda a origem do produto (não há marca de "criado na web"): TODO produto entra no espelho. Loja com Sync do
 *   Athos não deve cadastrar produto pela web (ele seria desativado); na Katatau todos vieram do Athos.
 */
export async function postProductsEspelhoSync(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
        produtos: z.array(z.object({ codigo: z.number().int().positive(), ativo: z.boolean() })),
        simular: z.boolean().nullable().optional(),
    })
    const { produtos, simular } = schema.parse(request.body)

    const naNuvem = await prisma.product.findMany({ select: { id: true, display_id: true, name: true, active: true } })
    const plano = planoDoEspelho(naNuvem, produtos)
    const resumo = (p: { display_id: number; name: string }) => ({ codigo: p.display_id, nome: p.name })
    const corpo = {
        simulado: simular === true,
        codigosNaLista: plano.codigosNaLista,
        ativosNaNuvem: plano.ativosNaNuvem,
        cobertos: plano.cobertos,
        cobertura: Math.round(plano.cobertura * 1000) / 10,
        foraDoSistema: plano.foraDoSistema.map(resumo),
        inativosNoSistema: plano.inativosNoSistema.map(resumo),
    }

    if (plano.recusar) {
        const motivo = plano.codigosNaLista === 0
            ? 'A lista de códigos do sistema da loja veio vazia: nada foi desativado.'
            : `A lista do sistema da loja tem ${plano.codigosNaLista} códigos e cobre só ${plano.cobertos} dos ${plano.ativosNaNuvem} produtos ativos da nuvem `
                + `(${corpo.cobertura}%, o mínimo é ${COBERTURA_MINIMA_DO_ESPELHO * 100}%). Pode ser o banco do Athos lido pela metade ou o banco errado: `
                + 'nada foi desativado. Confira a leitura do Athos e tente de novo.'
        request.log.warn({ codigosNaLista: plano.codigosNaLista, ativosNaNuvem: plano.ativosNaNuvem, cobertos: plano.cobertos }, '[Sync] Espelho recusado pela trava dos 80%')
        return reply.status(409).send({ ...corpo, recusado: true, desativados: 0, message: motivo })
    }

    const ids = [...plano.foraDoSistema, ...plano.inativosNoSistema].map((p) => p.id)
    const total = ids.length
    if (simular === true) {
        return reply.status(200).send({
            ...corpo, recusado: false, desativados: 0,
            message: `Simulação: ${plano.foraDoSistema.length} produto(s) ativos da nuvem com código que não existe no sistema da loja e `
                + `${plano.inativosNoSistema.length} inativo(s) lá iriam para inativo (${total} no total). Nada foi gravado.`
        })
    }

    let desativados = 0
    const agora = new Date()
    for (let i = 0; i < ids.length; i += 500) {
        const r = await prisma.product.updateMany({
            where: { id: { in: ids.slice(i, i + 500) } },
            data: { active: false, updated_at: agora }
        })
        desativados += r.count
    }
    if (desativados > 0) {
        request.log.warn({ desativados, foraDoSistema: corpo.foraDoSistema.slice(0, 50), inativosNoSistema: corpo.inativosNoSistema.slice(0, 50) },
            '[Sync] Espelho: produtos que não existem (ou estão inativos) no sistema da loja foram desativados')
    }
    return reply.status(200).send({
        ...corpo, recusado: false, desativados,
        message: desativados > 0
            ? `${desativados} produto(s) da nuvem foram para inativo: ${plano.foraDoSistema.length} com código que não existe no sistema da loja e ${plano.inativosNoSistema.length} inativo(s) lá.`
            : 'A nuvem já está igual ao sistema da loja: nenhum produto mudou.'
    })
}
/**
 * Devolve ao estoque as baixas de um item vendido que foi cancelado, uma vez só (marca stock_restored no registro do
 * cancelamento). Só acha as baixas gravadas com sale_item_id (vendas recebidas a partir do backend 2.6.89).
 */
async function estornarEstoqueDoItem(cancelamentoId: string, saleItemId: string, destino: string | null | undefined) {
    await prisma.$transaction(async (tx) => {
        const registro = await tx.cancellationAudit.findUnique({ where: { id: cancelamentoId }, select: { stock_restored: true } })
        if (!registro || !shouldReverseStock(destino, registro.stock_restored)) return
        const baixas = await tx.stock.findMany({ where: { sale_item_id: saleItemId, operation: 'OUT', description: 'VENDA' } })
        for (const b of baixas) {
            await tx.stock.create({
                data: {
                    quantity: b.quantity, operation: 'IN', description: 'DEVOLUCAO',
                    product_id: b.product_id, supply_id: b.supply_id, unit_cost: b.unit_cost, sale_item_id: saleItemId,
                }
            })
            if (b.product_id) await tx.product.update({ where: { id: b.product_id }, data: { stock: { increment: b.quantity } } })
            else if (b.supply_id) await tx.supply.update({ where: { id: b.supply_id }, data: { stock: { increment: b.quantity } } })
        }
        if (baixas.length > 0) {
            await tx.cancellationAudit.update({ where: { id: cancelamentoId }, data: { stock_restored: true } })
        }
    })
}

export async function postCancellationsSync(request: FastifyRequest, reply: FastifyReply) {
    const cancellationsSchema = z.array(z.object({
        Uuid: z.string().uuid(),
        PedidoUuid: z.string().uuid().optional().nullable(),
        PedidoItemUuid: z.string().uuid().optional().nullable(),
        ProdutoUuid: z.string().optional().nullable(),
        ProdutoNome: z.string(),
        Quantidade: z.number(),
        ValorUnitario: z.number(),
        ValorTotal: z.number(),
        Origem: z.string().default('MESA'),
        OrigemIdentificador: z.string().optional().nullable(),
        OrigemUuid: z.string().uuid().optional().nullable(),
        TipoCancelamento: z.string().default('ITEM_AVULSO'),
        Motivo: z.string(),
        UsuarioId: z.string().optional().nullable(),
        UsuarioNome: z.string().optional().nullable(),
        DataCancelamento: z.string().optional(),
        // Escolha do operador na janela de cancelamento: ESTORNO (devolver ao estoque) ou DESPERDICIO
        DestinoEstoque: z.string().optional().nullable(),
    }))

    const cancellations = cancellationsSchema.parse(request.body)
    // O PDV só marca como enviado o que estiver em "accepted"; o resto fica pendente com o motivo
    const accepted: string[] = []
    const ignored: { uuid: string; reason: string }[] = []

    for (const canc of cancellations) {
        // Grava na tabela de auditoria CancellationAudit
        try {
            await (prisma as any).cancellationAudit.upsert({
                where: { id: canc.Uuid },
                update: {
                    reason: canc.Motivo,
                    cancellation_type: canc.TipoCancelamento
                },
                create: {
                    id: canc.Uuid,
                    sale_id: canc.PedidoUuid || null,
                    order_id: canc.PedidoUuid || null,
                    item_id: canc.PedidoItemUuid || null,
                    product_id: canc.ProdutoUuid || null,
                    product_name: canc.ProdutoNome,
                    quantity: canc.Quantidade,
                    unit_price: canc.ValorUnitario,
                    total_amount: canc.ValorTotal,
                    origin: canc.Origem || 'MESA',
                    origin_identifier: canc.OrigemIdentificador || null,
                    origin_uuid: canc.OrigemUuid || null,
                    cancellation_type: canc.TipoCancelamento || 'ITEM_AVULSO',
                    reason: canc.Motivo,
                    user_id: canc.UsuarioId || null,
                    user_name: canc.UsuarioNome || null,
                    cancelled_at: canc.DataCancelamento ? new Date(canc.DataCancelamento) : new Date()
                }
            })
        } catch (auditErr) {
            // Antes o erro era engolido e o PDV recebia "ok": o cancelamento se perdia (a tabela nem existia até a
            // migration 20260925150000). Agora fica pendente no PDV, com o motivo, e é tentado de novo.
            console.error('[Sync] Falha ao persistir auditoria de cancelamento:', auditErr)
            ignored.push({ uuid: canc.Uuid, reason: 'ERRO_AO_GRAVAR' })
            continue
        }

        if (canc.PedidoUuid && (canc.TipoCancelamento === 'VENDA_COMPLETA' || canc.TipoCancelamento === 'DELIVERY_CANCELADO')) {
            const existingSale = await prisma.sale.findUnique({
                where: { id: canc.PedidoUuid }
            })
            if (existingSale) {
                // Só mexe no caixa DA venda e nunca em caixa já conferido (antes apagava lançamentos de qualquer caixa,
                // até conferido, sem desfazer o financeiro). Caixa conferido: fica pendente no PDV com o motivo.
                const session = existingSale.cashier_session_id
                    ? await prisma.cashierSession.findUnique({ where: { id: existingSale.cashier_session_id }, select: { status: true } })
                    : null
                if (session && !acceptsChanges(session) && existingSale.status !== 'CANCELLED') {
                    ignored.push({ uuid: canc.Uuid, reason: 'CAIXA_JA_CONFERIDO' })
                    continue
                }
                await prisma.$transaction([
                    prisma.sale.update({
                        where: { id: canc.PedidoUuid },
                        data: { status: 'CANCELLED' }
                    }),
                    prisma.cashierEntry.deleteMany({
                        where: {
                            cashier_session_id: existingSale.cashier_session_id ?? '__sem_caixa__',
                            type: 'SALE',
                            source: 'PDV',
                            // Pelo texto só o lançamento antigo, sem a venda gravada (02:P7: o texto leva só 8 caracteres do código)
                            OR: [{ sale_id: canc.PedidoUuid }, { sale_id: null, identification: { contains: saleEntryTag(canc.PedidoUuid) } }],
                        }
                    }),
                    // Fiado da venda cancelada sai da conta do cliente (10/10/2026; a parte já paga fica). Antes o cliente
                    // continuava devendo na nuvem e o saldo voltava ao PDV na sincronia seguinte.
                    // Fase 2 do Mergulho (02:P7): só a conta do caixa DA venda. A conta é achada pelos 8 primeiros caracteres
                    // do código da venda; antes, cancelar uma venda apagava o a prazo de QUALQUER venda que começasse igual.
                    prisma.clientTab.deleteMany({
                        where: { is_paid: false, description: { contains: saleEntryTag(canc.PedidoUuid) }, cashier_session_id: existingSale.cashier_session_id }
                    }),
                    // Vale de consumo criado pela venda nas versões até 2.6.107 (hoje o vale nasce só na conferência)
                    prisma.payrollEntry.deleteMany({
                        where: { status: 'PENDING', description: { startsWith: `Consumo PDV - ${saleEntryTag(canc.PedidoUuid)}` } }
                    }),
                ])

                // Estoque segue a escolha do operador (decisão do Thomás, 25/09): "Devolver ao Estoque" desfaz as baixas
                // deste item; "Registrar como Desperdício" mantém a saída.
                if (canc.PedidoItemUuid) {
                    await estornarEstoqueDoItem(canc.Uuid, canc.PedidoItemUuid, canc.DestinoEstoque)
                }
            }

            const existingPedido = await prisma.pedido.findFirst({
                where: { uuid: canc.PedidoUuid }
            })
            if (existingPedido) {
                await prisma.pedido.update({
                    where: { id: existingPedido.id },
                    data: {
                        status: 'Cancelado',
                        motivo_cancelamento: canc.Motivo
                    }
                })
            }
        }
        accepted.push(canc.Uuid)
    }

    return reply.status(201).send({
        message: `${accepted.length} cancelamentos sincronizados com sucesso.`,
        count: accepted.length,
        accepted,
        ignored
    })
}

export async function getCancellationsSync(request: FastifyRequest, reply: FastifyReply) {
    try {
        const audits = await (prisma as any).cancellationAudit.findMany({
            orderBy: { cancelled_at: 'desc' },
            take: 100,
        })
        return reply.status(200).send({
            cancellations: (audits || []).map((c: any) => ({
                id: c.id,
                date: c.cancelled_at,
                created_at: c.cancelled_at,
                origin: c.origin,
                origin_id: c.origin_identifier || c.origin,
                item_name: c.product_name,
                quantity: Number(c.quantity || 1),
                unit_price: Number(c.unit_price || 0),
                total_value: Number(c.total_amount || 0),
                reason: c.reason,
                cancelled_by: c.user_name || 'Operador',
                cancellation_type: c.cancellation_type,
            }))
        })
    } catch (err) {
        return reply.status(200).send({ cancellations: [] })
    }
}
