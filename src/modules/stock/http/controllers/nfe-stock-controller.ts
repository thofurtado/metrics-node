import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NfeParserService } from '../../services/nfe-parser.service'
import { GeminiAiService, CandidateItem } from '../../../ai/services/gemini-ai.service'
import { registrarMovimento, usuarioDaRequisicao } from '../../services/movimento-de-estoque'

const nfeParser = new NfeParserService()
const geminiAi = new GeminiAiService()

export async function postParseNfe(request: FastifyRequest, reply: FastifyReply) {
    const parseBodySchema = z.object({
        xml: z.string().min(10, 'XML muito curto ou inválido.')
    })

    const { xml } = parseBodySchema.parse(request.body)

    try {
        // 1. Parse do XML SEFAZ
        const { header, items } = nfeParser.parse(xml)

        // 2. Busca configurações do sistema (chaves de IA e tenant)
        const systemConfig = await prisma.systemConfig.findFirst()
        const geminiApiKey = systemConfig?.gemini_api_key || process.env.GEMINI_API_KEY
        const geminiModel = systemConfig?.gemini_model || 'gemini-1.5-flash'

        // 3. Busca De-Para já existente para o fornecedor
        const existingMappings = await prisma.supplierProductMapping.findMany({
            where: { supplier_cnpj: header.fornecedor.cnpj },
            include: { supply: true, product: true }
        })

        const mappingMap = new Map(existingMappings.map(m => [m.supplier_product_code, m]))

        // Separa os itens que precisam de inferência por IA
        const itemsToInfer: any[] = []
        const mappedResults: any[] = []

        for (const item of items) {
            const mapped = mappingMap.get(item.codigo)
            if (mapped) {
                const stockQty = item.quantidade * mapped.conversion_factor
                const unitCost = mapped.conversion_factor > 0 ? (item.valorUnitario / mapped.conversion_factor) : item.valorUnitario
                mappedResults.push({
                    itemNota: item,
                    isAlreadyMapped: true,
                    matchedType: mapped.supply_id ? 'SUPPLY' : 'PRODUCT',
                    matchedId: mapped.supply_id || mapped.product_id,
                    matchedName: mapped.supply?.name || mapped.product?.name,
                    conversionFactor: mapped.conversion_factor,
                    resultingStock: stockQty,
                    resultingUnitCost: unitCost,
                    confidence: 1.0,
                    reasoning: 'Mapeamento De-Para previamente gravado para este fornecedor.'
                })
            } else {
                itemsToInfer.push(item)
            }
        }

        // Se houver itens não mapeados, invoca a IA para sugerir
        if (itemsToInfer.length > 0) {
            // Carrega insumos e produtos para matching
            const [supplies, products] = await Promise.all([
                prisma.supply.findMany({
                    where: { active: true },
                    select: { id: true, name: true, unit: true }
                }),
                prisma.product.findMany({
                    where: { active: true },
                    select: { id: true, name: true }
                })
            ])

            const candidates: CandidateItem[] = [
                ...supplies.map(s => ({ id: s.id, name: s.name, unit: s.unit, type: 'SUPPLY' as const })),
                ...products.map(p => ({ id: p.id, name: p.name, type: 'PRODUCT' as const }))
            ]

            const aiSuggestions = await geminiAi.matchNfeItems(
                itemsToInfer.map(it => ({
                    codigo: it.codigo,
                    nome: it.nome,
                    unidade: it.unidade,
                    quantidade: it.quantidade,
                    valorUnitario: it.valorUnitario
                })),
                candidates,
                geminiApiKey,
                geminiModel
            )

            const suggestionMap = new Map(aiSuggestions.map(s => [s.item_code, s]))

            for (const item of itemsToInfer) {
                const sug = suggestionMap.get(item.codigo)
                const factor = sug?.conversion_factor || 1.0
                const stockQty = item.quantidade * factor
                const unitCost = factor > 0 ? (item.valorUnitario / factor) : item.valorUnitario

                mappedResults.push({
                    itemNota: item,
                    isAlreadyMapped: false,
                    matchedType: sug?.matched_type || null,
                    matchedId: sug?.matched_id || null,
                    matchedName: sug?.matched_name || null,
                    conversionFactor: factor,
                    resultingStock: stockQty,
                    resultingUnitCost: unitCost,
                    confidence: sug?.confidence ?? 0,
                    reasoning: sug?.reasoning || 'Sugestão automática gerada pela IA.'
                })
            }
        }

        // Ordena pela numeração original do item na nota
        mappedResults.sort((a, b) => a.itemNota.numeroItem - b.itemNota.numeroItem)

        return reply.status(200).send({
            header,
            items: mappedResults
        })

    } catch (error: any) {
        return reply.status(400).send({
            message: error.message || 'Erro ao processar o XML da NFe.'
        })
    }
}

/** Número da nota pela chave de 44 números (posições 26 a 34), quando a tela não manda o número. */
export function numeroDaChave(chave: string | null | undefined): string | null {
    const so = (chave ?? '').replace(/\D/g, '')
    if (so.length !== 44) return null
    return String(Number(so.slice(25, 34)))
}

/**
 * Entrada de mercadorias pela NF-e de compra (D5: as compras entram pelo Metrics, somam ao estoque e atualizam o custo).
 * Etapa 4 (16/10/2026): cada entrada guarda a nota (chave e número), quem deu entrada e o saldo logo depois, para o histórico
 * do produto abrir a nota. A mesma nota não entra duas vezes. Item sem produto/insumo escolhido é recusado com o nome (antes
 * a tela mandava um código inventado e mostrava "creditada" mesmo com a nuvem recusando). Nota sem valor não zera o custo.
 */
export async function postConfirmNfe(request: FastifyRequest, reply: FastifyReply) {
    const confirmSchema = z.object({
        header: z.object({
            chaveNfe: z.string().optional().default(''),
            numeroNota: z.string().optional(),
            numeroNfe: z.string().optional(),
            fornecedor: z.object({
                cnpj: z.string(),
                razaoSocial: z.string()
            })
        }),
        items: z.array(z.object({
            supplierProductCode: z.string(),
            supplierProductName: z.string(),
            supplierUnit: z.string(),
            supplierQuantity: z.number().min(0),
            /** Quantidade que entra no estoque, na unidade do produto/insumo (já convertida pela tela). */
            stockQuantity: z.number().min(0).optional(),
            supplierUnitPrice: z.number().min(0),
            targetType: z.enum(['SUPPLY', 'PRODUCT']),
            targetId: z.string().uuid({ message: 'Escolha o produto ou insumo de cada item da nota.' }),
            conversionFactor: z.number().positive().default(1.0),
            saveMapping: z.boolean().default(true),
            batchNumber: z.string().optional().nullable(),
            expirationDate: z.string().optional().nullable(),
            portioning: z.object({
                enabled: z.boolean(),
                portionSizeGrams: z.number().positive(),
                portionCount: z.number().positive(),
                trimGrams: z.number().default(0),
                costPerPortion: z.number().optional(),
                portionSupplyName: z.string().optional()
            }).optional().nullable()
        })).min(1, 'A nota não tem nenhum item para dar entrada.')
    })

    const { header, items } = confirmSchema.parse(request.body)
    const chave = header.chaveNfe.replace(/\D/g, '')
    const numero = (header.numeroNota || header.numeroNfe || '').trim() || numeroDaChave(chave)
    const usuario = await usuarioDaRequisicao(request)

    // A mesma nota duas vezes somaria o estoque em dobro (duplo clique, rascunho reaberto)
    if (chave) {
        const jaEntrou = await prisma.stock.findFirst({ where: { document_key: chave }, select: { created_at: true, user_name: true } })
        if (jaEntrou) {
            const quando = jaEntrou.created_at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
            return reply.status(409).send({
                message: `Esta nota já deu entrada em ${quando}${jaEntrou.user_name ? ` por ${jaEntrou.user_name}` : ''}. Nada foi somado de novo.`,
                code: 'NOTA_JA_ENTROU',
            })
        }
    }

    // Todo item precisa apontar para um produto/insumo que existe
    const faltam: string[] = []
    for (const item of items) {
        const existe = item.targetType === 'SUPPLY'
            ? await prisma.supply.findUnique({ where: { id: item.targetId }, select: { id: true } })
            : await prisma.product.findUnique({ where: { id: item.targetId }, select: { id: true } })
        if (!existe) faltam.push(item.supplierProductName)
    }
    if (faltam.length > 0) {
        return reply.status(400).send({ message: `Escolha o produto ou insumo destes itens da nota: ${faltam.join(', ')}.`, code: 'ITEM_SEM_VINCULO', items: faltam })
    }

    let totalStockAdded = 0
    const documento = { chave: chave || null, numero }

    await prisma.$transaction(async (tx) => {
        for (const item of items) {
            const fator = item.conversionFactor > 0 ? item.conversionFactor : 1
            const stockQty = item.stockQuantity ?? item.supplierQuantity * fator
            const unitCost = item.supplierUnitPrice / fator
            if (!(stockQty > 0)) continue // não entregue

            // 1. Salva ou atualiza o De-Para para futuras notas se solicitado
            if (item.saveMapping) {
                await tx.supplierProductMapping.upsert({
                    where: {
                        supplier_cnpj_supplier_product_code: {
                            supplier_cnpj: header.fornecedor.cnpj,
                            supplier_product_code: item.supplierProductCode
                        }
                    },
                    update: {
                        supplier_name: header.fornecedor.razaoSocial,
                        supplier_product_name: item.supplierProductName,
                        supplier_unit: item.supplierUnit,
                        conversion_factor: fator,
                        supply_id: item.targetType === 'SUPPLY' ? item.targetId : null,
                        product_id: item.targetType === 'PRODUCT' ? item.targetId : null,
                    },
                    create: {
                        supplier_cnpj: header.fornecedor.cnpj,
                        supplier_name: header.fornecedor.razaoSocial,
                        supplier_product_code: item.supplierProductCode,
                        supplier_product_name: item.supplierProductName,
                        supplier_unit: item.supplierUnit,
                        conversion_factor: fator,
                        supply_id: item.targetType === 'SUPPLY' ? item.targetId : null,
                        product_id: item.targetType === 'PRODUCT' ? item.targetId : null,
                    }
                })
            }

            const validade = item.expirationDate ? new Date(item.expirationDate) : null
            const comum = {
                operacao: 'IN' as const,
                motivo: 'COMPRA' as const,
                usuario,
                documento,
                fornecedorCnpj: header.fornecedor.cnpj,
                lote: item.batchNumber || null,
                validade: validade && !Number.isNaN(validade.getTime()) ? validade : null,
            }

            // 2. Entrada no estoque (o saldo e a linha juntos; a linha guarda a nota, quem deu entrada e o saldo depois)
            if (item.portioning && item.portioning.enabled && item.portioning.portionCount > 0) {
                // Porcionamento (opcional, ainda em decisão): a peça entra já em porções, num insumo próprio
                const portionName = item.portioning.portionSupplyName || `${item.supplierProductName} ${item.portioning.portionSizeGrams}g Porcionada`
                const portionCost = item.portioning.costPerPortion || (stockQty * unitCost) / item.portioning.portionCount

                let portionedSupply = await tx.supply.findFirst({ where: { name: portionName } })
                if (!portionedSupply) {
                    portionedSupply = await tx.supply.create({
                        data: { name: portionName, unit: 'UN', cost: portionCost, stock: 0, category: 'Porcionados / Carnes' }
                    })
                }
                await registrarMovimento(tx, {
                    ...comum,
                    alvo: { tipo: 'SUPPLY', id: portionedSupply.id },
                    quantidade: item.portioning.portionCount,
                    custoUnitario: portionCost,
                    custoNovo: portionCost,
                    nota: `Porcionado: ${stockQty} ${item.supplierUnit} de ${item.supplierProductName}`,
                })
                // A peça bruta só tem o custo atualizado (ela entrou como porções)
                if (item.targetType === 'SUPPLY' && unitCost > 0) {
                    await tx.supply.update({ where: { id: item.targetId }, data: { cost: unitCost } })
                }
                totalStockAdded += item.portioning.portionCount
            } else {
                await registrarMovimento(tx, {
                    ...comum,
                    alvo: { tipo: item.targetType, id: item.targetId },
                    quantidade: stockQty,
                    custoUnitario: unitCost,
                    custoNovo: unitCost,
                })
                totalStockAdded += stockQty
            }
        }
    }, { timeout: 60000, maxWait: 10000 })

    return reply.status(201).send({
        message: 'Entrada no estoque feita.',
        processedItems: items.length,
        totalStockAdded
    })
}

// ==================== INVENTÁRIO / CONTAGEM CEGA ====================

export async function postOpenInventorySession(request: FastifyRequest, reply: FastifyReply) {
    const openSchema = z.object({
        sector: z.string().optional().default('GERAL'),
        blindCount: z.boolean().default(true),
        notes: z.string().optional()
    })

    const { sector, blindCount, notes } = openSchema.parse(request.body)
    const userId = (request.user as any)?.sub || null

    const session = await prisma.$transaction(async (tx) => {
        const newSession = await tx.inventorySession.create({
            data: {
                user_id: userId,
                sector,
                blind_count: blindCount,
                notes,
                status: 'OPEN'
            }
        })

        // Congela o saldo atual de todos os insumos e produtos
        const [supplies, products] = await Promise.all([
            tx.supply.findMany({ where: { active: true } }),
            tx.product.findMany({ where: { active: true, NOT: { AND: [{ is_composite: true }, { compositions: { some: {} } }] } } })
        ])

        const itemsData: any[] = [
            ...supplies.map(s => ({
                inventory_session_id: newSession.id,
                supply_id: s.id,
                system_quantity: s.stock ?? 0,
                counted_quantity: 0,
                unit_cost: s.cost ?? 0,
            })),
            ...products.map(p => ({
                inventory_session_id: newSession.id,
                product_id: p.id,
                system_quantity: p.stock ?? 0,
                counted_quantity: 0,
                unit_cost: p.cost ?? 0,
            }))
        ]

        if (itemsData.length > 0) {
            await tx.inventoryItem.createMany({
                data: itemsData
            })
        }

        return newSession
    })

    return reply.status(201).send(session)
}

export async function getInventorySessionDetails(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const { id } = paramsSchema.parse(request.params)

    const session = await prisma.inventorySession.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    supply: { select: { id: true, name: true, unit: true, cost: true } },
                    product: { select: { id: true, name: true, cost: true } }
                }
            }
        }
    })

    if (!session) {
        return reply.status(404).send({ message: 'Sessão de inventário não encontrada.' })
    }

    // Se o modo contagem cega estiver ativo e a sessão ainda estiver aberta,
    // oculta o saldo do sistema para o conferente
    const isBlindActive = session.blind_count && session.status === 'OPEN'

    const sanitizedItems = session.items.map(item => ({
        id: item.id,
        name: item.supply?.name || item.product?.name,
        unit: item.supply?.unit || 'UN',
        systemQuantity: isBlindActive ? null : item.system_quantity,
        countedQuantity: item.counted_quantity,
        unitCost: item.unit_cost,
        differenceQuantity: isBlindActive ? null : (item.counted_quantity - item.system_quantity),
        totalDifferenceCost: isBlindActive ? null : ((item.counted_quantity - item.system_quantity) * item.unit_cost)
    }))

    return reply.send({
        ...session,
        items: sanitizedItems
    })
}

const MOTIVOS_DO_INVENTARIO = ['AJUSTE_NEGATIVO', 'AJUSTE_POSITIVO', 'QUEBRA', 'PERDA', 'CONSUMO_INTERNO'] as const
type MotivoDoInventario = (typeof MOTIVOS_DO_INVENTARIO)[number]

/** O motivo de cada diferença da contagem: o escolhido, se combina com a direção; senão, ajuste (+ ou -). */
export function motivoDoInventario(diferenca: number, escolhido?: string | null): MotivoDoInventario {
    if (diferenca > 0) return 'AJUSTE_POSITIVO'
    if (escolhido === 'QUEBRA' || escolhido === 'PERDA' || escolhido === 'CONSUMO_INTERNO') return escolhido
    return 'AJUSTE_NEGATIVO'
}

class SessaoFechada extends Error {}

/**
 * Aplica a contagem (etapa 4, 16/10/2026): cada diferença vira um movimento com quem contou, o motivo escolhido na tela (antes
 * a tela pedia o motivo e não mandava; toda falta virava "quebra") e o saldo logo depois. Só os itens que mudaram são gravados.
 */
export async function postApplyInventorySession(request: FastifyRequest, reply: FastifyReply) {
    const applySchema = z.object({
        sessionId: z.string().uuid(),
        counts: z.array(z.object({
            itemId: z.string().uuid(),
            countedQuantity: z.number().min(0),
            reason: z.enum(MOTIVOS_DO_INVENTARIO).optional().nullable(),
        }))
    })

    const { sessionId, counts } = applySchema.parse(request.body)
    const usuario = await usuarioDaRequisicao(request)
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    let ajustados = 0

    try {
        await prisma.$transaction(async (tx) => {
            const session = await tx.inventorySession.findUnique({
                where: { id: sessionId },
                include: { items: true }
            })

            if (!session || session.status !== 'OPEN') {
                throw new SessaoFechada()
            }

            const countsMap = new Map(counts.map(c => [c.itemId, c]))

            for (const item of session.items) {
                const enviado = countsMap.get(item.id)
                const counted = enviado?.countedQuantity ?? item.counted_quantity
                const diff = Number((counted - item.system_quantity).toFixed(6))
                if (!enviado && diff === 0) continue // nada mudou neste item

                await tx.inventoryItem.update({
                    where: { id: item.id },
                    data: { counted_quantity: counted, difference_quantity: diff, total_difference_cost: diff * item.unit_cost }
                })

                // Diferença na contagem: o saldo passa a ser o contado, com o movimento no histórico (quem contou e quando)
                if (diff !== 0 && (item.supply_id || item.product_id)) {
                    await registrarMovimento(tx, {
                        alvo: item.supply_id ? { tipo: 'SUPPLY', id: item.supply_id } : { tipo: 'PRODUCT', id: item.product_id! },
                        operacao: diff > 0 ? 'IN' : 'OUT',
                        quantidade: Math.abs(diff),
                        motivo: motivoDoInventario(diff, enviado?.reason),
                        custoUnitario: item.unit_cost,
                        saldoNovo: counted,
                        usuario,
                        nota: `Inventário de ${hoje}`,
                    })
                    ajustados++
                }
            }

            await tx.inventorySession.update({
                where: { id: sessionId },
                data: { status: 'APPLIED', closed_at: new Date() }
            })
        }, { timeout: 120000, maxWait: 10000 })
    } catch (err) {
        if (err instanceof SessaoFechada) return reply.status(409).send({ message: 'Esta contagem já foi aplicada ou não existe mais. Abra a aba de novo.' })
        throw err
    }

    return reply.status(200).send({
        message: ajustados > 0 ? `Contagem aplicada: ${ajustados} item(ns) com o saldo corrigido.` : 'Contagem aplicada: nenhum saldo mudou.',
        adjusted: ajustados,
    })
}
