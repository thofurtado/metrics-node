import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { Transaction } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { TransferTransactionsRepository } from '@/modules/financial/repositories/transfer-transactions-repository'
import { prisma } from '@/lib/prisma'

function addMonthsPreservingLastDay(baseDate: Date, months: number): Date {
    const d = new Date(baseDate)
    const targetMonth = d.getMonth() + months
    const originalDay = d.getDate()
    
    const result = new Date(d.getFullYear(), targetMonth, 1, d.getHours(), d.getMinutes(), d.getSeconds())
    const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
    result.setDate(Math.min(originalDay, daysInTargetMonth))
    return result
}

function addWeeks(baseDate: Date, weeks: number): Date {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + (weeks * 7))
    return d
}

interface TransactionUseCaseRequest {
    operation: string,
    amount: number;
    account_id?: string | null;
    date?: Date | null;
    data_vencimento?: Date | null;
    data_emissao?: Date | null;
    sector_id?: string | null;
    description?: string | null;
    confirmed: boolean | null;
    destination_account_id?: string | null;
    supplier_id?: string | null;
    payment_method?: string | null;
    installments_count?: number;
    interval_frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    custom_installments?: { data_vencimento: Date, data_emissao?: Date, amount: number }[];
    interest?: number | null;
    fine?: number | null;
    discount?: number | null;
    totalValue?: number | null;
    credit_card_id?: string | null;
}

interface TransactionUseCaseResponse {
    transaction: Transaction
}

export class TransactionUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository,
        private transferTransactionsRepository: TransferTransactionsRepository,
        private accountsRepository: AccountsRepository
    ) { }

    async execute({
        operation, amount, account_id, date, data_vencimento, data_emissao, sector_id, description, confirmed, destination_account_id, supplier_id, payment_method, installments_count, interval_frequency, custom_installments, interest, fine, discount, totalValue, credit_card_id
    }: TransactionUseCaseRequest): Promise<TransactionUseCaseResponse> {

        if (operation !== 'income' && operation !== 'expense' && operation !== 'transfer') {
            throw new ResourceNotFoundError()
        }

        if (!account_id) {
            throw new ResourceNotFoundError()
        }

        const account = await this.accountsRepository.findById(account_id)
        if (!account) throw new ResourceNotFoundError()

        const isIncome = operation === 'income' ? true : false

        let installmentsPlan: { data_vencimento: Date, data_emissao: Date, amount: number, number: number }[] = []

        const baseDescription = description || ''
        const effectiveVencimento = data_vencimento || date || new Date()
        const effectiveEmissao = data_emissao || date || new Date()

        const totalInstallments = installments_count && installments_count > 1 ? installments_count : 1

        if (totalInstallments > 1) {
            if (!custom_installments || custom_installments.length === 0) {
                custom_installments = []
                const baseAmount = Math.floor((amount / totalInstallments) * 100) / 100
                const remainder = Number((amount - (baseAmount * totalInstallments)).toFixed(2))

                for (let i = 1; i <= totalInstallments; i++) {
                    const instAmount = i === 1 ? Number((baseAmount + remainder).toFixed(2)) : baseAmount
                    let d: Date
                    if (interval_frequency === 'WEEKLY') {
                        d = addWeeks(effectiveVencimento, i - 1)
                    } else {
                        d = addMonthsPreservingLastDay(effectiveVencimento, i - 1)
                    }
                    custom_installments.push({
                        amount: instAmount,
                        data_vencimento: d,
                        data_emissao: effectiveEmissao
                    })
                }
            }

            installmentsPlan = custom_installments.map((inst, index) => ({
                data_vencimento: new Date(inst.data_vencimento),
                data_emissao: inst.data_emissao ? new Date(inst.data_emissao) : effectiveEmissao,
                amount: inst.amount,
                number: index + 1
            }))
        } else {
            installmentsPlan.push({ data_vencimento: effectiveVencimento, data_emissao: effectiveEmissao, amount, number: 1 })
        }

        const isInMemory = this.transactionsRepository.constructor.name.includes('InMemory')

        const executeLogic = async (tx?: any) => {
            let firstTransaction: any = null

            if (installmentsPlan.length > 1) {
                if (!isInMemory && tx?.transactionGroup) {
                    const group = await tx.transactionGroup.create({
                        data: {
                            totalAmount: amount,
                            installmentsCount: installmentsPlan.length,
                            description: description,
                            frequency: interval_frequency || null,
                            transactions: {
                                create: installmentsPlan.map((item) => {
                                    const isFirst = item.number === 1
                                    const tag = isFirst ? `(${item.number}/${installmentsPlan.length})` : `(PR ${item.number}/${installmentsPlan.length})`
                                    const currentDescription = baseDescription ? `${baseDescription} ${tag}` : tag
                                    const isConfirmed = isFirst ? (operation === 'transfer' ? true : confirmed ? confirmed : false) : false

                                    return {
                                        operation,
                                        amount: item.amount,
                                        account_id: account_id || null,
                                        data_vencimento: item.data_vencimento,
                                        data_emissao: item.data_emissao,
                                        sector_id: sector_id || null,
                                        description: currentDescription,
                                        confirmed: isConfirmed,
                                        supplier_id: supplier_id || null,
                                        payment_method: payment_method || "BOLETO",
                                        interest: isFirst ? interest : 0,
                                        fine: isFirst ? fine : 0,
                                        discount: isFirst ? discount : 0,
                                        totalValue: isFirst && totalValue !== null ? totalValue : (isConfirmed ? item.amount : null),
                                        credit_card_id: credit_card_id || null,
                                    } as any
                                })
                            }
                        },
                        include: {
                            transactions: true
                        }
                    })
                    const firstTag = `(1/${installmentsPlan.length})`
                    firstTransaction = (group as any).transactions.find((t: Transaction) => t.description?.includes(firstTag)) || (group as any).transactions[0]
                } else {
                    let parentId: string | null = null
                    for (const item of installmentsPlan) {
                        const isFirst = item.number === 1
                        const tag = isFirst ? `(${item.number}/${installmentsPlan.length})` : `(PR ${item.number}/${installmentsPlan.length})`
                        const currentDescription = baseDescription ? `${baseDescription} ${tag}` : tag
                        const isConfirmed = isFirst ? (operation === 'transfer' ? true : confirmed ? confirmed : false) : false
                        const created: any = await this.transactionsRepository.create({
                            operation,
                            amount: item.amount,
                            account_id: account_id || '',
                            data_vencimento: item.data_vencimento,
                            data_emissao: item.data_emissao,
                            sector_id: sector_id || null,
                            description: currentDescription,
                            confirmed: isConfirmed,
                            parent_transaction_id: parentId,
                            supplier_id: supplier_id || null,
                            payment_method: payment_method || "BOLETO",
                            credit_card_id: credit_card_id || null,
                        })
                        if (isFirst) {
                            firstTransaction = created
                            parentId = created.id
                        }
                    }
                }
            } else {
                const item = installmentsPlan[0]
                const isConfirmed = operation === 'transfer' ? true : confirmed ? confirmed : false

                if (!isInMemory && tx?.transaction) {
                    firstTransaction = await tx.transaction.create({
                        data: {
                            operation,
                            amount: item.amount,
                            account_id: account_id || null,
                            data_vencimento: item.data_vencimento,
                            data_emissao: item.data_emissao,
                            sector_id: sector_id || null,
                            description: baseDescription,
                            confirmed: isConfirmed,
                            supplier_id: supplier_id || null,
                            payment_method: payment_method || "BOLETO",
                            interest,
                            discount,
                            totalValue: totalValue !== null ? totalValue : (isConfirmed ? item.amount : null),
                            credit_card_id: credit_card_id || null,
                        } as any
                    })
                } else {
                    firstTransaction = await this.transactionsRepository.create({
                        operation,
                        amount: item.amount,
                        account_id: account_id || '',
                        data_vencimento: item.data_vencimento,
                        data_emissao: item.data_emissao,
                        sector_id: sector_id || null,
                        description: baseDescription,
                        confirmed: isConfirmed,
                        supplier_id: supplier_id || null,
                        payment_method: payment_method || "BOLETO",
                        credit_card_id: credit_card_id || null,
                    })
                }
            }

            if (!firstTransaction) throw new Error("Failed to create transaction")

            if (firstTransaction.confirmed && firstTransaction.account_id) {
                const effectiveAmount = firstTransaction.totalValue ?? firstTransaction.amount
                await this.accountsRepository.changeBalance(firstTransaction.account_id, effectiveAmount, isIncome, tx)
            }

            if (destination_account_id && operation === 'transfer' && firstTransaction.confirmed) {
                if (!isInMemory && tx?.transaction) {
                    await tx.transaction.create({
                        data: {
                            operation: 'income',
                            amount,
                            account_id: destination_account_id,
                            description: `Transferência de ${firstTransaction.account_id}`,
                            confirmed: true,
                            data_vencimento: effectiveVencimento,
                            data_emissao: effectiveEmissao,
                            payment_method: "TRANSFERENCIA",
                        } as any
                    })
                } else {
                    await this.transactionsRepository.create({
                        operation: 'income',
                        amount,
                        account_id: destination_account_id,
                        description: `Transferência de ${firstTransaction.account_id}`,
                        confirmed: true,
                        data_vencimento: effectiveVencimento,
                        data_emissao: effectiveEmissao,
                    })
                }
                await this.accountsRepository.changeBalance(destination_account_id, amount, true, tx)
            }

            return {
                transaction: firstTransaction
            }
        }

        if (isInMemory) {
            return await executeLogic()
        }

        return await prisma.$transaction(async (tx) => {
            return await executeLogic(tx)
        })
    }
}
