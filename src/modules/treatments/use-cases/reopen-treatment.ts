import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'
import { Treatment } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ProductsRepository } from '@/modules/items/repositories/products-repository'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { prisma } from '@/lib/prisma'

interface ReopenTreatmentUseCaseRequest {
    treatment_id: string
}

interface ReopenTreatmentUseCaseResponse {
    treatment: Treatment
}

/**
 * Desfaz um atendimento (O.S.) finalizado: processo inverso e completo do `FinishTreatmentUseCase`.
 *
 * - Estorna cada transação financeira gerada por essa O.S. (se estava confirmada, devolve o valor
 *   real pago — totalValue — para a conta) e apaga a transação (o vínculo TreatmentTransaction some
 *   junto, por cascade).
 * - Devolve ao estoque exatamente o que foi baixado no fechamento: produto simples, supply direto ou,
 *   em produto composto, cada insumo da composição — usando os mesmos dados (produto/composição) que
 *   o fechamento usou.
 * - Volta o status para "pending" e limpa a data de encerramento, liberando a O.S. para edição.
 *
 * Não existia nenhum jeito de desfazer uma O.S. finalizada por engano; sem isso, "corrigir" significava
 * editar por fora e o financeiro/estoque ficavam desalinhados.
 */
export class ReopenTreatmentUseCase {
    constructor(
        private treatmentsRepository: TreatmentsRepository,
        private accountsRepository: AccountsRepository,
        private productsRepository: ProductsRepository | any,
        private suppliesRepository: SuppliesRepository | any,
    ) { }

    async execute({ treatment_id }: ReopenTreatmentUseCaseRequest): Promise<ReopenTreatmentUseCaseResponse> {
        const treatment = await this.treatmentsRepository.findById(treatment_id)
        if (!treatment) {
            throw new ResourceNotFoundError()
        }

        if (treatment.status !== 'resolved' && treatment.status !== 'finished') {
            throw new Error('Este atendimento não está finalizado, não há o que reabrir.')
        }

        const executeLogic = async (tx?: any) => {
            // A. Estorna as transações financeiras vinculadas a esta O.S.
            const links = tx?.treatmentTransaction?.findMany
                ? await tx.treatmentTransaction.findMany({
                    where: { treatment_id },
                    include: { transaction: true },
                })
                : []

            for (const link of links) {
                const t = link.transaction
                if (t.confirmed && t.account_id) {
                    const amountToRevert = t.totalValue ?? t.amount
                    const isIncome = t.operation === 'income'
                    await this.accountsRepository.changeBalance(t.account_id, amountToRevert, !isIncome, tx)
                }
                if (tx?.transaction?.delete) {
                    await tx.transaction.delete({ where: { id: t.id } })
                }
            }

            // B. Devolve ao estoque o que foi baixado no fechamento (mesma lógica do finish, ao contrário)
            if ((treatment as any).items && (treatment as any).items.length > 0) {
                for (const tItem of (treatment as any).items) {
                    const prodId = tItem.product_id || tItem.item_id || (tItem.product ? tItem.product.id : null)
                    const supplyId = tItem.supply_id || (tItem.supply ? tItem.supply.id : null)

                    if (prodId) {
                        const product = (tItem as any).product

                        if (product && product.is_composite && product.compositions && product.compositions.length > 0) {
                            for (const comp of product.compositions) {
                                const quantityToRestore = comp.quantity * tItem.quantity
                                if (this.suppliesRepository?.changeStock) {
                                    await this.suppliesRepository.changeStock(comp.supply_id, quantityToRestore, true, tx)
                                }
                                if (tx?.stock?.create) {
                                    await tx.stock.create({
                                        data: {
                                            supply_id: comp.supply_id,
                                            quantity: quantityToRestore,
                                            operation: 'IN',
                                            description: 'REABERTURA O.S.',
                                            created_at: new Date(),
                                        },
                                    })
                                }
                            }
                        } else {
                            if (this.productsRepository?.changeStock) {
                                await this.productsRepository.changeStock(prodId, tItem.quantity, true, tx)
                            }
                            if (tx?.stock?.create) {
                                await tx.stock.create({
                                    data: {
                                        product_id: prodId,
                                        quantity: tItem.quantity,
                                        operation: 'IN',
                                        description: 'REABERTURA O.S.',
                                        created_at: new Date(),
                                    },
                                })
                            }
                        }
                    } else if (supplyId) {
                        if (this.suppliesRepository?.changeStock) {
                            await this.suppliesRepository.changeStock(supplyId, tItem.quantity, true, tx)
                        }
                        if (tx?.stock?.create) {
                            await tx.stock.create({
                                data: {
                                    supply_id: supplyId,
                                    quantity: tItem.quantity,
                                    operation: 'IN',
                                    description: 'REABERTURA O.S.',
                                    created_at: new Date(),
                                },
                            })
                        }
                    }
                }
            }

            // C. Reabre a O.S.
            const reopened = tx?.treatment?.update
                ? await tx.treatment.update({
                    where: { id: treatment_id },
                    data: { status: 'pending', ending_date: null },
                })
                : await this.treatmentsRepository.update(treatment_id, { status: 'pending', ending_date: null } as any)

            return { treatment: reopened }
        }

        if (this.treatmentsRepository.constructor.name.includes('InMemory')) {
            return await executeLogic()
        }

        return await prisma.$transaction(async (tx) => {
            return await executeLogic(tx)
        })
    }
}
