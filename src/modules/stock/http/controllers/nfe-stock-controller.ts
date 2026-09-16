import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NfeParserService } from '../../services/nfe-parser.service'
import { GeminiAiService, CandidateItem } from '../../../ai/services/gemini-ai.service'

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

export async function postConfirmNfe(request: FastifyRequest, reply: FastifyReply) {
    const confirmSchema = z.object({
        header: z.object({
            chaveNfe: z.string(),
            numeroNota: z.string(),
            fornecedor: z.object({
                cnpj: z.string(),
                razaoSocial: z.string()
            })
        }),
        items: z.array(z.object({
            supplierProductCode: z.string(),
            supplierProductName: z.string(),
            supplierUnit: z.string(),
            supplierQuantity: z.number().positive(),
            supplierUnitPrice: z.number().min(0),
            targetType: z.enum(['SUPPLY', 'PRODUCT']),
            targetId: z.string().uuid(),
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
        }))
    })

    const { header, items } = confirmSchema.parse(request.body)

    let totalStockAdded = 0

    await prisma.$transaction(async (tx) => {
        for (const item of items) {
            const stockQty = item.supplierQuantity * item.conversionFactor
            const unitCost = item.conversionFactor > 0 ? (item.supplierUnitPrice / item.conversionFactor) : item.supplierUnitPrice

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
                        conversion_factor: item.conversionFactor,
                        supply_id: item.targetType === 'SUPPLY' ? item.targetId : null,
                        product_id: item.targetType === 'PRODUCT' ? item.targetId : null,
                    },
                    create: {
                        supplier_cnpj: header.fornecedor.cnpj,
                        supplier_name: header.fornecedor.razaoSocial,
                        supplier_product_code: item.supplierProductCode,
                        supplier_product_name: item.supplierProductName,
                        supplier_unit: item.supplierUnit,
                        conversion_factor: item.conversionFactor,
                        supply_id: item.targetType === 'SUPPLY' ? item.targetId : null,
                        product_id: item.targetType === 'PRODUCT' ? item.targetId : null,
                    }
                })
            }

            // 2. Grava a movimentação de entrada no histórico Stock
            const expDate = item.expirationDate ? new Date(item.expirationDate) : null

            await tx.stock.create({
                data: {
                    operation: 'IN',
                    description: 'COMPRA',
                    quantity: stockQty,
                    unit_cost: unitCost,
                    supplier_cnpj: header.fornecedor.cnpj,
                    batch_number: item.batchNumber || null,
                    expiration_date: expDate,
                    supply_id: item.targetType === 'SUPPLY' ? item.targetId : null,
                    product_id: item.targetType === 'PRODUCT' ? item.targetId : null,
                }
            })

            // 3. Atualiza o saldo e custo no cadastro
            if (item.portioning && item.portioning.enabled && item.portioning.portionCount > 0) {
                // Trata o porcionamento para a cozinha
                const portionName = item.portioning.portionSupplyName || `${item.supplierProductName} ${item.portioning.portionSizeGrams}g Porcionada`
                const portionCost = item.portioning.costPerPortion || (stockQty > 0 ? (stockQty * unitCost) / item.portioning.portionCount : unitCost)

                // Localiza ou cria o insumo porcionado
                let portionedSupply = await tx.supply.findFirst({
                    where: { name: portionName }
                })

                if (!portionedSupply) {
                    portionedSupply = await tx.supply.create({
                        data: {
                            name: portionName,
                            unit: 'UN',
                            cost: portionCost,
                            stock: item.portioning.portionCount,
                            category: 'Porcionados / Carnes'
                        }
                    })
                } else {
                    await tx.supply.update({
                        where: { id: portionedSupply.id },
                        data: {
                            stock: { increment: item.portioning.portionCount },
                            cost: portionCost
                        }
                    })
                }

                // Registra a movimentação de entrada da porção pronta
                await tx.stock.create({
                    data: {
                        operation: 'IN',
                        description: 'AJUSTE_POSITIVO',
                        quantity: item.portioning.portionCount,
                        unit_cost: portionCost,
                        batch_number: item.batchNumber || null,
                        expiration_date: expDate,
                        supply_id: portionedSupply.id
                    }
                })

                // Mantém registro da matéria-prima bruta com saldo zero ou aparas
                if (item.targetType === 'SUPPLY') {
                    await tx.supply.update({
                        where: { id: item.targetId },
                        data: {
                            cost: unitCost
                        }
                    })
                }
            } else {
                if (item.targetType === 'SUPPLY') {
                    await tx.supply.update({
                        where: { id: item.targetId },
                        data: {
                            stock: { increment: stockQty },
                            cost: unitCost
                        }
                    })
                } else {
                    await tx.product.update({
                        where: { id: item.targetId },
                        data: {
                            stock: { increment: stockQty },
                            cost: unitCost
                        }
                    })
                }
            }

            totalStockAdded += stockQty
        }
    })

    return reply.status(201).send({
        message: 'Entrada de estoque realizada com sucesso e De-Para gravado.',
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
            tx.product.findMany({ where: { active: true, is_composite: false } })
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

export async function postApplyInventorySession(request: FastifyRequest, reply: FastifyReply) {
    const applySchema = z.object({
        sessionId: z.string().uuid(),
        counts: z.array(z.object({
            itemId: z.string().uuid(),
            countedQuantity: z.number().min(0)
        }))
    })

    const { sessionId, counts } = applySchema.parse(request.body)

    await prisma.$transaction(async (tx) => {
        const session = await tx.inventorySession.findUnique({
            where: { id: sessionId },
            include: { items: true }
        })

        if (!session || session.status !== 'OPEN') {
            throw new Error('Sessão de inventário não encontrada ou já finalizada.')
        }

        const countsMap = new Map(counts.map(c => [c.itemId, c.countedQuantity]))

        for (const item of session.items) {
            const counted = countsMap.get(item.id) ?? item.counted_quantity
            const diff = counted - item.system_quantity
            const totalDiffCost = diff * item.unit_cost

            // Atualiza o item do inventário com o resultado final
            await tx.inventoryItem.update({
                where: { id: item.id },
                data: {
                    counted_quantity: counted,
                    difference_quantity: diff,
                    total_difference_cost: totalDiffCost
                }
            })

            // Se houver divergência, gera movimentação de ajuste no Stock
            if (diff !== 0) {
                const operation = diff > 0 ? 'IN' : 'OUT'
                const reason = diff > 0 ? 'AJUSTE_POSITIVO' : 'QUEBRA'

                await tx.stock.create({
                    data: {
                        operation,
                        description: reason,
                        quantity: Math.abs(diff),
                        unit_cost: item.unit_cost,
                        supply_id: item.supply_id,
                        product_id: item.product_id,
                    }
                })

                // Atualiza o saldo real no cadastro para bater com o físico
                if (item.supply_id) {
                    await tx.supply.update({
                        where: { id: item.supply_id },
                        data: { stock: counted }
                    })
                } else if (item.product_id) {
                    await tx.product.update({
                        where: { id: item.product_id },
                        data: { stock: counted }
                    })
                }
            }
        }

        // Fecha a sessão
        await tx.inventorySession.update({
            where: { id: sessionId },
            data: {
                status: 'APPLIED',
                closed_at: new Date()
            }
        })
    })

    return reply.status(200).send({ message: 'Inventário aplicado e saldos atualizados com sucesso.' })
}
