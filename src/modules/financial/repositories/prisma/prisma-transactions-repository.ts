import { Prisma, Transaction } from '@prisma/client'
import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { prisma } from '@/lib/prisma'
import { GetTransactionsDTO } from '@/modules/financial/repositories/DTO/get-transactions-dto'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { ChangeTransactionStatusParams } from '@/modules/financial/repositories/DTO/change-transaction-status-params-dto'






export class PrismaTransactionsRepository implements TransactionsRepository {
    // Versão otimizada com Promise.all (mais rápida)
    async getFinancialSummary(date?: Date): Promise<{
        totalBalance: number;
        monthlyIncome: number;
        monthlyExpenses: number;
        pendingIncome: number;
        pendingExpenses: number;
        overdueIncome: number;    // A receber vencido (todos os meses)
        overdueExpenses: number;  // A pagar vencido (todos os meses)
    }> {
        const currentDate = date || new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);

        // 🔥 CORREÇÃO: Criar startOfToday (00:00:00 do dia atual)
        const startOfToday = new Date(currentDate);
        startOfToday.setHours(0, 0, 0, 0);

        // Executa todas as consultas em paralelo
        const [
            totalBalance,
            monthlyIncomeResult,
            monthlyExpensesResult,
            pendingIncomeResult,
            pendingExpensesResult,
            overdueIncomeResult,
            overdueExpensesResult
        ] = await Promise.all([
            this.getBalance(),
            // Entradas totais do mês
            prisma.transaction.aggregate({
                where: {
                    operation: 'income',
                    data_vencimento: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // Saídas totais do mês
            prisma.transaction.aggregate({
                where: {
                    operation: 'expense',
                    data_vencimento: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // A receber do mês (pendentes)
            prisma.transaction.aggregate({
                where: {
                    operation: 'income',
                    confirmed: false,
                    data_vencimento: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // A pagar do mês (pendentes)
            prisma.transaction.aggregate({
                where: {
                    operation: 'expense',
                    confirmed: false,
                    data_vencimento: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // 🔥 CORREÇÃO: A receber vencido (usando startOfToday)
            prisma.transaction.aggregate({
                where: {
                    operation: 'income',
                    confirmed: false,
                    data_vencimento: { lt: startOfToday } // Data menor que HOJE 00:00 = vencido
                },
                _sum: { amount: true }
            }),
            // 🔥 CORREÇÃO: A pagar vencido (usando startOfToday)
            prisma.transaction.aggregate({
                where: {
                    operation: 'expense',
                    confirmed: false,
                    data_vencimento: { lt: startOfToday } // Data menor que HOJE 00:00 = vencido
                },
                _sum: { amount: true }
            })
        ]);

        return {
            totalBalance,
            monthlyIncome: monthlyIncomeResult._sum.amount || 0,
            monthlyExpenses: monthlyExpensesResult._sum.amount || 0,
            pendingIncome: pendingIncomeResult._sum.amount || 0,
            pendingExpenses: pendingExpensesResult._sum.amount || 0,
            overdueIncome: overdueIncomeResult._sum.amount || 0,    // A receber vencido
            overdueExpenses: overdueExpensesResult._sum.amount || 0 // A pagar vencido
        };
    }
    async getBalance(): Promise<number> {
        // Usando aggregate para soma direta no banco
        const balanceResult = await prisma.account.aggregate({
            _sum: {
                balance: true
            }
        })

        return Number(balanceResult._sum.balance) || 0
    }
    async getMonthIncomeByDays(date?: Date): Promise<{ day: string; revenue: number; }[]> {
        const month = date || new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1

        const dailyIncomes = await prisma.transaction.groupBy({
            by: ['data_vencimento'],
            _sum: {
                amount: true,
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1)
                        },
                    },
                    {
                        operation: 'income',
                    },
                ],
            },
            orderBy: {
                data_vencimento: 'asc'
            }
        })

        return dailyIncomes.map((income) => ({
            day: income.data_vencimento.toISOString().substring(5, 10),
            revenue: income._sum.amount || 0, // Garante que não seja null
        }))
    }
    async getMonthExpenseBySector(date?: Date): Promise<{ sector_name: string; amount: number; }[]> {
        const month = date || new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1

        const sectorExpenses = await prisma.transaction.groupBy({
            by: ['sector_id'],
            _sum: {
                amount: true,
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1)
                        },
                    },
                    {
                        operation: 'expense',
                    },
                ],
            },
        })

        const sectorIds = sectorExpenses.map((expense) => expense.sector_id)

        // CORREÇÃO: Filtrar apenas sector_ids válidos (não nulos)
        const validSectorIds = sectorIds.filter((id): id is string => id !== null)

        // CORREÇÃO: Buscar apenas setores com IDs válidos
        const sectors = await Promise.all(
            validSectorIds.map((id) => prisma.sector.findFirst({ where: { id } }))
        )

        // CORREÇÃO: Mapear corretamente os setores com as despesas
        return sectorExpenses.map((expense) => {
            // Para despesas sem setor (sector_id = null)
            if (expense.sector_id === null) {
                return {
                    sector_name: 'Sem setor',
                    amount: Number((expense._sum.amount || 0).toFixed(2)),
                }
            }

            // Encontrar o setor correspondente
            const sectorIndex = validSectorIds.indexOf(expense.sector_id)
            const sectorName = sectorIndex !== -1 ? sectors[sectorIndex]?.name : 'Setor não encontrado'

            return {
                sector_name: sectorName || 'Setor não encontrado',
                amount: Number((expense._sum.amount || 0).toFixed(2)),
            }
        })
    }
    async getMonthExpenseAmount(date?: Date): Promise<{
        monthExpenseAmount: number;
        diffFromLastMonth: number;
        alreadyPaid: number
    }> {
        const month = date || new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1

        const thisMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
            _sum: {
                amount: true
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    {
                        confirmed: true
                    },
                    {
                        operation: 'expense'
                    }
                ]
            }
        })

        const thisMonthTransactionsAmount = await prisma.transaction.aggregate({
            _sum: {
                amount: true
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    {
                        operation: 'expense'
                    }
                ]
            }
        })

        const lastMonthTransactionsAmount = await prisma.transaction.aggregate({
            _sum: {
                amount: true
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1),
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1),
                        },
                    },
                    {
                        operation: 'expense'
                    }
                ]
            }
        })

        // CORREÇÃO: Tratar valores nulos
        const thisMonthAmount = thisMonthTransactionsAmount._sum.amount || 0;
        const lastMonthAmount = lastMonthTransactionsAmount._sum.amount || 0;
        const alreadyPaid = thisMonthTransactionsPaidAmount._sum.amount || 0;

        // CORREÇÃO: Cálculo seguro da diferença
        let diffFromLastMonth = 0;
        if (lastMonthAmount > 0) {
            diffFromLastMonth = Number((((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100).toFixed(2));
        } else if (thisMonthAmount > 0) {
            // Se último mês foi 0 e este mês tem valor, é 100% de aumento
            diffFromLastMonth = 100;
        }

        return {
            monthExpenseAmount: thisMonthAmount,
            alreadyPaid,
            diffFromLastMonth
        }
    }
    async getMonthIncomeAmount(date?: Date): Promise<{
        monthIncomeAmount: number;
        diffFromLastMonth: number;
        alreadyPaid: number
    }> {
        const month = date || new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1

        // CORREÇÃO: Adicionei as declarações das variáveis
        const thisMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
            _sum: {
                amount: true
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    {
                        confirmed: true
                    },
                    {
                        operation: 'income'
                    }
                ]
            }
        })

        const thisMonthTransactionsAmount = await prisma.transaction.aggregate({
            _sum: {
                amount: true
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    {
                        operation: 'income'
                    }
                ]
            }
        })

        const lastMonthTransactionsAmount = await prisma.transaction.aggregate({
            _sum: {
                amount: true
            },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1),
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1),
                        },
                    },
                    {
                        operation: 'income'
                    }
                ]
            }
        })

        // CORREÇÃO: Tratar valores nulos
        const thisMonthAmount = thisMonthTransactionsAmount._sum.amount || 0;
        const lastMonthAmount = lastMonthTransactionsAmount._sum.amount || 0;
        const alreadyPaid = thisMonthTransactionsPaidAmount._sum.amount || 0;

        // CORREÇÃO: Cálculo seguro da diferença
        let diffFromLastMonth = 0;
        if (lastMonthAmount > 0) {
            diffFromLastMonth = Number((((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100).toFixed(2));
        } else if (thisMonthAmount > 0) {
            // Se último mês foi 0 e este mês tem valor, é 100% de aumento
            diffFromLastMonth = 100;
        }

        return {
            monthIncomeAmount: thisMonthAmount,
            alreadyPaid,
            diffFromLastMonth
        }
    }
    async delete(id: string): Promise<void> {
        const transaction = await prisma.transaction.findUnique({ where: { id } })

        if (!transaction) {
            return
        }

        // Se a transação estiver confirmada, precisamos reverter o valor do saldo da conta
        if (transaction.confirmed) {
            let balanceChange = 0
            if (transaction.operation === 'income') {
                balanceChange = -transaction.amount
            } else if (transaction.operation === 'expense') {
                balanceChange = transaction.amount
            }

            await prisma.$transaction([
                prisma.account.update({
                    where: { id: transaction.account_id },
                    data: {
                        balance: {
                            increment: balanceChange
                        }
                    }
                }),
                prisma.transaction.delete({
                    where: { id }
                })
            ])
        } else {
            // Se não estiver confirmada, apenas deleta
            await prisma.transaction.delete({
                where: { id }
            })
        }
    }

    async changeTransactionStatus(data: ChangeTransactionStatusParams): Promise<void> {
        // Agora só desestrutura id, amount e date
        const { id, amount: newAmount, date, account_id } = data

        // 1. Busca a transação original para verificar a existência e o status
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id },
        })

        if (!existingTransaction) {
            throw new ResourceNotFoundError()
        }

        // Se a transação JÁ estiver confirmada, não fazemos nada (Use Case deve garantir isso, mas é uma segurança)
        if (existingTransaction.confirmed) {
            return
        }

        // 2. Determinar o valor a ser adicionado/removido do saldo da conta
        // Como a transação estava PENDENTE (confirmed: false) e está sendo liquidada com newAmount,
        // aplicamos o newAmount no saldo.
        let accountBalanceChange = 0;

        if (existingTransaction.operation === 'income') {
            // É uma receita. Aumenta o saldo.
            accountBalanceChange = newAmount
        } else if (existingTransaction.operation === 'expense') {
            // É uma despesa. Diminui o saldo.
            accountBalanceChange = -newAmount
        }

        const targetAccountId = account_id || existingTransaction.account_id

        // 3. Executa a transação de banco de dados (atomicidade)
        try {
            await prisma.$transaction(async (tx) => {
                // a) Atualiza a Transação Original: Confirma com o novo valor e a data de liquidação
                // Se account_id foi passado, atualiza também a conta vinculada.
                await tx.transaction.update({
                    where: { id },
                    data: {
                        amount: newAmount, // Novo valor (pago parcial ou total)
                        data_vencimento: date, // Nova data de liquidação (data de liquidação efetiva)
                        confirmed: true, // Hardcoded: a função é para liquidar/confirmar
                        account_id: targetAccountId // Atualiza a conta se mudou
                    },
                })

                // b) Atualiza o Saldo da Conta (da conta FINAL, onde o pagamento ocorreu)
                await tx.account.update({
                    where: { id: targetAccountId },
                    data: {
                        balance: {
                            // Adiciona/Remove o valor liquidado do saldo existente
                            increment: accountBalanceChange,
                        },
                    },
                })
            })
        } catch (error) {
            console.error('Erro na transação de liquidação:', error)
            // Relançar o erro, possivelmente encapsulado
            throw new Error('Falha ao liquidar a transação e atualizar o saldo da conta.')
        }
    }

    async revertTransactionStatus(id: string): Promise<void> {
        // 1. Busca a transação original
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id },
        })

        if (!existingTransaction) {
            throw new ResourceNotFoundError()
        }

        // Check for traceability (Fragmentation)
        const childCount = await prisma.transaction.count({
            where: { parent_transaction_id: id }
        })

        if (existingTransaction.parent_transaction_id || childCount > 0) {
            console.warn("Atenção: Estornando parte de uma transação fragmentada. Verificar saldo original.")
        }

        // Se já estiver Pendente, não faz nada
        if (!existingTransaction.confirmed) {
            return
        }

        // 2. Determinar o impacto no saldo (Reverso da Liquidação)
        let accountBalanceChange = 0;

        if (existingTransaction.operation === 'income') {
            // Era receita (+). Reverter significa retirar do saldo (-).
            accountBalanceChange = -existingTransaction.amount
        } else if (existingTransaction.operation === 'expense') {
            // Era despesa (-). Reverter significa devolver ao saldo (+).
            accountBalanceChange = existingTransaction.amount
        }

        const targetAccountId = existingTransaction.account_id

        // 3. Executa a transação do banco de dados (atomicidade)
        try {
            await prisma.$transaction(async (tx) => {
                // a) Atualiza a Transação: Marca como Pendente (false)
                await tx.transaction.update({
                    where: { id },
                    data: {
                        confirmed: false,
                        // Não alteramos a data. A data que estava vira a data de vencimento.
                    },
                })

                // b) Atualiza o Saldo da Conta
                await tx.account.update({
                    where: { id: targetAccountId },
                    data: {
                        balance: {
                            increment: accountBalanceChange,
                        },
                    },
                })
            })
        } catch (error) {
            console.error('Erro na reversão da transação:', error)
            throw new Error('Falha ao reverter a transação e atualizar o saldo.')
        }
    }

    async update(data: Prisma.TransactionUncheckedUpdateInput): Promise<Transaction> {
        // Verifica se o ID foi fornecido
        if (!data.id) {
            throw new Error('Transaction ID is required for update');
        }

        // CORREÇÃO: Preparar os dados de atualização sem as relações
        const updateData: Prisma.TransactionUncheckedUpdateInput = {
            operation: data.operation,
            data_vencimento: data.data_vencimento,
            amount: data.amount,
            description: data.description,
            confirmed: data.confirmed,
        };

        // CORREÇÃO: Se account_id foi fornecido, atualiza diretamente
        if (data.account_id !== undefined) {
            updateData.account_id = data.account_id;
        }

        // CORREÇÃO: Se sector_id foi fornecido, atualiza diretamente
        if (data.sector_id !== undefined) {
            updateData.sector_id = data.sector_id;
        }

        const updatedTransaction = await prisma.transaction.update({
            where: {
                id: data.id as string
            },
            data: updateData
        });

        return updatedTransaction;
    }
    async findMany(month: Date, pageIndex?: number, perPage?: number, description?: string, value?: number, sector_id?: string, account_id?: string, status?: string, toDate?: Date, supplier_id?: string, operation?: string): Promise<GetTransactionsDTO | null> {

        let take = perPage ? Number(perPage) : 6
        let skip = 0
        if (pageIndex && pageIndex > 1) {
            skip = (pageIndex - 1) * take
        }
        let sector
        if (sector_id === 'all') {
            sector = undefined
        } else {
            sector = sector_id
        }
        let account
        if (account_id === 'all') {
            account = undefined
        } else {
            account = account_id
        }
        // Status filter logic
        let confirmedFilter: boolean | undefined = undefined;
        if (status === 'pending') {
            confirmedFilter = false;
        } else if (status === 'completed') {
            confirmedFilter = true;
        }

        const year = month.getFullYear()
        const monthNumber = month.getMonth() + 1

        // Define date filter logic
        let dateFilter: Prisma.DateTimeFilter<"Transaction"> | undefined;

        if (status === 'pending') {
            // Horizon Flow: "Todas as não pagas (independente data) + futuras até toDate"
            // Se confirmado = false, buscamos tudo <= toDate (que inclui passado + futuro próximo)
            // Se toDate não for passado, assumimos um padrão (ex: hoje + 7 dias - handled in Use Case usually, but here as fallback)
            const targetDate = toDate || new Date(new Date().setDate(new Date().getDate() + 7));

            // Set end of day for targetDate to be inclusive
            targetDate.setHours(23, 59, 59, 999);

            dateFilter = {
                lte: targetDate
            }
        } else {
            // Default Month Flow (History)
            dateFilter = {
                gte: new Date(year, monthNumber - 1, 1), // Start of month
                lt: new Date(year, monthNumber, 1), // End of month (excluding the last day)
            }
        }

        const whereConditions: Prisma.TransactionWhereInput = {
            AND: [
                {
                    data_vencimento: dateFilter // Use dynamic date filter
                },
                {
                    sectors: {
                        id: { equals: sector }
                    }
                },
                {
                    accounts: {
                        id: { equals: account }
                    }
                },
                {
                    supplier_id: supplier_id ? {
                        equals: supplier_id
                    } : undefined
                },
                {
                    description: {
                        contains: description,
                        mode: 'insensitive'
                    }
                },
                {
                    amount: {
                        equals: value
                    }
                },
                // Add confirmed filter if status is provided
                ...(confirmedFilter !== undefined ? [{ confirmed: confirmedFilter }] : []),
                {
                    operation: operation ? { equals: operation } : undefined
                }
            ]
        }

        const totalCount = await prisma.transaction.count({
            where: whereConditions
        })

        const transactions = await prisma.transaction.findMany({
            skip, take,
            where: whereConditions,
            orderBy: [
                { data_vencimento: 'asc' },
                { created_at: 'desc' },
                { id: 'asc' }
            ],
            include: {
                accounts: true,
                sectors: true
            }
        })

        return {
            transactions,
            totalCount,
            perPage: take,
            pageIndex
        }
    }
    async findById(id: string): Promise<Transaction | null> {
        const transaction = prisma.transaction.findFirst({
            where: {
                id
            }
        })
        return transaction
    }

    async create(data: Prisma.TransactionUncheckedCreateInput, tx?: Prisma.TransactionClient) {
        if (!data.data_vencimento) {
            data.data_vencimento = new Date()
        }
        if (!(data as any).data_emissao) {
            (data as any).data_emissao = new Date()
        }
        if (!data.confirmed) {
            data.confirmed = false
        }
        const createTransaction = {
            ...data,
            account_id: undefined,
            sector_id: undefined
        }
        const client = tx ?? prisma

        let transaction
        if (!data.sector_id) {
            transaction = await client.transaction.create({
                data: {
                    ...createTransaction,
                    accounts: {
                        connect: { id: data.account_id }
                    }
                }

            })
        } else {
            transaction = await client.transaction.create({
                data: {
                    ...createTransaction,
                    accounts: {
                        connect: { id: data.account_id }
                    },
                    sectors: {
                        connect: { id: data.sector_id }
                    }
                }
            })
        }

        return transaction
    }

    async markAsPaidMany(ids: string[]): Promise<void> {
        // 1. Busca transações que serão atualizadas para calcular o impacto no saldo
        const transactionsToUpdate = await prisma.transaction.findMany({
            where: {
                id: { in: ids },
                confirmed: false // Apenas as que ainda não estão pagas
            }
        })

        if (transactionsToUpdate.length === 0) {
            return
        }

        // 2. Executa atualização em transação para garantir atomicidade
        await prisma.$transaction(async (tx) => {
            // a) Atualiza status de todas
            await tx.transaction.updateMany({
                where: {
                    id: { in: ids }
                },
                data: {
                    confirmed: true,
                    // Opcional: Atualizar a data para hoje? 
                    // Se não atualizar, assume que foi pago na data original prevista.
                    // O requisito pede apenas "atualizar o status... para PAID".
                    // Manteremos a data original para evitar efeitos colaterais indesejados.
                }
            })

            // b) Atualiza saldo das contas
            for (const transaction of transactionsToUpdate) {
                let balanceChange = 0

                if (transaction.operation === 'income') {
                    balanceChange = transaction.amount
                } else if (transaction.operation === 'expense') {
                    balanceChange = -transaction.amount
                }

                if (balanceChange !== 0) {
                    await tx.account.update({
                        where: { id: transaction.account_id },
                        data: {
                            balance: {
                                increment: balanceChange
                            }
                        }
                    })
                }
            }
        })
    }
}
