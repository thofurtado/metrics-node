import { Prisma, TransferTransaction } from '@prisma/client'
import { TransferTransactionsRepository } from '@/modules/financial/repositories/transfer-transactions-repository'
import { prisma } from '@/lib/prisma'

export class PrismaTransferTransactionsRepository implements TransferTransactionsRepository {
    async findByAccount(account_id: string): Promise<TransferTransaction[] | null> {
        const transferTransaction = await prisma.transferTransaction.findMany({
            where: {
                OR: [
                    { destTransaction: { account_id } },
                    { sourceTransaction: { account_id } }
                ]
            }
        })
        return transferTransaction
    }

    async create(data: Prisma.TransferTransactionUncheckedCreateInput, tx?: Prisma.TransactionClient) {
        const client = tx ?? prisma
        const transaction = client.transferTransaction.create({
            data
        })

        return transaction
    }

    async findMany() {
        const transferTransactions = await prisma.transferTransaction.findMany({
            include: {
                sourceTransaction: {
                    include: {
                        accounts: true
                    }
                },
                destTransaction: {
                    include: {
                        accounts: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        })

        return transferTransactions.map((t: any) => ({
            id: t.id,
            source_transaction_id: t.source_transaction_id,
            dest_transaction_id: t.dest_transaction_id,
            fee_amount: t.fee_amount,
            description: t.description,
            is_automated: t.is_automated,
            created_at: t.created_at,
            destination_account_id: t.destTransaction?.account_id || '',
            transaction_id: t.source_transaction_id,
            transaction: t.sourceTransaction,
            accounts: t.destTransaction?.accounts || { name: 'Destino' }
        })) as any
    }

    async executeTransfer({ originTransactionId, destinationAccountId, amount, originAccountName }: {
        originTransactionId: string
        destinationAccountId: string
        amount: number
        originAccountName: string
    }): Promise<TransferTransaction> {
        return await prisma.$transaction(async (tx) => {
            // 1. Débito na Origem: Atualizar saldo e confirmar transação
            const originTx = await tx.transaction.update({
                where: { id: originTransactionId },
                data: { confirmed: true }
            })

            if (originTx.account_id) {
                await tx.account.update({
                    where: { id: originTx.account_id },
                    data: {
                        balance: { decrement: amount }
                    }
                })
            }

            // 2. Crédito no Destino
            const destTx = await tx.transaction.create({
                data: {
                    operation: 'income',
                    account_id: destinationAccountId,
                    amount: amount,
                    data_vencimento: new Date(),
                    data_emissao: new Date(),
                    confirmed: true,
                    description: `Transferência recebida de ${originAccountName}`,
                }
            })

            await tx.account.update({
                where: { id: destinationAccountId },
                data: {
                    balance: { increment: amount }
                }
            })

            // 3. Registro de Transferência
            return await tx.transferTransaction.create({
                data: {
                    source_transaction_id: originTransactionId,
                    dest_transaction_id: destTx.id,
                    description: `Transferência: ${originAccountName} -> Destino`,
                    is_automated: true
                }
            })
        })
    }
}
