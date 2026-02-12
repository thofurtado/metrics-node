import { Prisma, TransferTransaction } from '@prisma/client'
import { TransferTransactionsRepository } from '@/modules/financial/repositories/transfer-transactions-repository'
import { prisma } from '@/lib/prisma'





export class PrismaTransferTransactionsRepository implements TransferTransactionsRepository {
    async findByAccount(account_id: string): Promise<TransferTransaction[] | null> {
        const transferTransaction = prisma.transferTransaction.findMany({
            where: {
                destination_account_id: account_id
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
                transaction: {
                    include: {
                        accounts: true
                    }
                },
                accounts: true
            },
            orderBy: {
                transaction: {
                    date: 'desc'
                }
            }
        })
        return transferTransactions
    }

    async executeTransfer({ originTransactionId, destinationAccountId, amount, originAccountName }: {
        originTransactionId: string
        destinationAccountId: string
        amount: number
        originAccountName: string
    }): Promise<TransferTransaction> {
        return await prisma.$transaction(async (tx) => {
            // 1. Débito na Origem: Atualizar saldo e confirmar transação
            // Busca transaction para garantir (ou confia no ID passado)
            const originTx = await tx.transaction.update({
                where: { id: originTransactionId },
                data: { confirmed: true }
            })

            await tx.account.update({
                where: { id: originTx.account_id },
                data: {
                    balance: { decrement: amount }
                }
            })

            // 2. Crédito no Destino
            await tx.transaction.create({
                data: {
                    operation: 'income',
                    account_id: destinationAccountId,
                    amount: amount,
                    date: new Date(), // Data da transferência efetiva
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
                    transaction_id: originTransactionId,
                    destination_account_id: destinationAccountId
                }
            })
        })
    }
}
