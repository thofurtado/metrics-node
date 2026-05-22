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
            // Entradas PAGAS do mês
            prisma.transaction.aggregate({
                where: {
                    operation: 'income',
                    confirmed: true,
                    data_vencimento: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { totalValue: true }
            }),
            // Saídas PAGAS do mês
            prisma.transaction.aggregate({
                where: {
                    operation: 'expense',
                    confirmed: true,
                    data_vencimento: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { totalValue: true }
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

        const pendingInc = pendingIncomeResult._sum.amount || 0;
        const pendingExp = pendingExpensesResult._sum.amount || 0;
        const confirmedInc = monthlyIncomeResult._sum.totalValue || 0;
        const confirmedExp = monthlyExpensesResult._sum.totalValue || 0;

        return {
            totalBalance,
            monthlyIncome: pendingInc + confirmedInc,
            monthlyExpenses: pendingExp + confirmedExp,
            pendingIncome: pendingInc,
            pendingExpenses: pendingExp,
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

        const dailyIncomesPending = await prisma.transaction.groupBy({
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
                    {
                        confirmed: false,
                    }
                ],
            },
            orderBy: {
                data_vencimento: 'asc'
            }
        })

        const dailyIncomesConfirmed = await prisma.transaction.groupBy({
            by: ['data_vencimento'],
            _sum: {
                totalValue: true,
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
                    {
                        confirmed: true,
                    }
                ],
            },
            orderBy: {
                data_vencimento: 'asc'
            }
        })

        const combinedIncomes = new Map<string, number>();
        for (const item of dailyIncomesPending) {
            const key = item.data_vencimento.toISOString().substring(5, 10);
            combinedIncomes.set(key, (combinedIncomes.get(key) || 0) + (item._sum.amount || 0));
        }
        for (const item of dailyIncomesConfirmed) {
            const key = item.data_vencimento.toISOString().substring(5, 10);
            combinedIncomes.set(key, (combinedIncomes.get(key) || 0) + (item._sum.totalValue || 0));
        }

        return Array.from(combinedIncomes.entries())
            .map(([day, revenue]) => ({ day, revenue }))
            .sort((a, b) => a.day.localeCompare(b.day));
    }
    async getMonthExpenseBySector(date?: Date): Promise<{ sector_name: string; amount: number; }[]> {
        const month = date || new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1

        const sectorExpensesPending = await prisma.transaction.groupBy({
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
                    {
                        confirmed: false,
                    }
                ],
            },
        })

        const sectorExpensesConfirmed = await prisma.transaction.groupBy({
            by: ['sector_id'],
            _sum: {
                totalValue: true,
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
                    {
                        confirmed: true,
                    }
                ],
            },
        })

        const combinedSectorExpenses = new Map<string | null, number>();
        for (const item of sectorExpensesPending) {
            combinedSectorExpenses.set(item.sector_id, (combinedSectorExpenses.get(item.sector_id) || 0) + (item._sum.amount || 0));
        }
        for (const item of sectorExpensesConfirmed) {
            combinedSectorExpenses.set(item.sector_id, (combinedSectorExpenses.get(item.sector_id) || 0) + (item._sum.totalValue || 0));
        }

        const sectorIds = Array.from(combinedSectorExpenses.keys());
        const validSectorIds = sectorIds.filter((id): id is string => id !== null)

        const sectors = await Promise.all(
            validSectorIds.map((id) => prisma.sector.findFirst({ where: { id } }))
        )

        return Array.from(combinedSectorExpenses.entries()).map(([sector_id, amount]) => {
            if (sector_id === null) {
                return {
                    sector_name: 'Sem setor',
                    amount: Number(amount.toFixed(2)),
                }
            }
            const sectorIndex = validSectorIds.indexOf(sector_id)
            const sectorName = sectorIndex !== -1 ? sectors[sectorIndex]?.name : 'Setor não encontrado'
            return {
                sector_name: sectorName || 'Setor não encontrado',
                amount: Number(amount.toFixed(2)),
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
            _sum: { totalValue: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    { confirmed: true },
                    { operation: 'expense' }
                ]
            }
        })

        const thisMonthTransactionsPendingAmount = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    { confirmed: false },
                    { operation: 'expense' }
                ]
            }
        })

        const lastMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
            _sum: { totalValue: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1),
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1),
                        },
                    },
                    { confirmed: true },
                    { operation: 'expense' }
                ]
            }
        })

        const lastMonthTransactionsPendingAmount = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1),
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1),
                        },
                    },
                    { confirmed: false },
                    { operation: 'expense' }
                ]
            }
        })

// Substituído pelas consultas separadas acima

        // CORREÇÃO: Tratar valores nulos
        const alreadyPaid = thisMonthTransactionsPaidAmount._sum.totalValue || 0;
        const thisMonthAmount = alreadyPaid + (thisMonthTransactionsPendingAmount._sum.amount || 0);
        const lastMonthAmount = (lastMonthTransactionsPaidAmount._sum.totalValue || 0) + (lastMonthTransactionsPendingAmount._sum.amount || 0);

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
            _sum: { totalValue: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    { confirmed: true },
                    { operation: 'income' }
                ]
            }
        })

        const thisMonthTransactionsPendingAmount = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
                            lt: new Date(thisMonthYear, thisMonthNumber, 1),
                        },
                    },
                    { confirmed: false },
                    { operation: 'income' }
                ]
            }
        })

        const lastMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
            _sum: { totalValue: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1),
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1),
                        },
                    },
                    { confirmed: true },
                    { operation: 'income' }
                ]
            }
        })

        const lastMonthTransactionsPendingAmount = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                AND: [
                    {
                        data_vencimento: {
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1),
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1),
                        },
                    },
                    { confirmed: false },
                    { operation: 'income' }
                ]
            }
        })

        // CORREÇÃO: Tratar valores nulos
        // CORREÇÃO: Tratar valores nulos
        const alreadyPaid = thisMonthTransactionsPaidAmount._sum.totalValue || 0;
        const thisMonthAmount = alreadyPaid + (thisMonthTransactionsPendingAmount._sum.amount || 0);
        const lastMonthAmount = (lastMonthTransactionsPaidAmount._sum.totalValue || 0) + (lastMonthTransactionsPendingAmount._sum.amount || 0);

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
    async delete(id: string, skipGroupUpdate?: boolean): Promise<void> {
        const transaction = await prisma.transaction.findUnique({ where: { id } })

        if (!transaction) {
            return
        }

        const txOps: any[] = []

        if (transaction.confirmed) {
            let balanceChange = 0
            const targetAmount = transaction.totalValue ?? transaction.amount;
            
            if (transaction.operation === 'income') {
                balanceChange = -targetAmount
            } else if (transaction.operation === 'expense') {
                balanceChange = targetAmount
            }

            if (transaction.account_id) {
                txOps.push(
                    prisma.account.update({
                        where: { id: transaction.account_id },
                        data: {
                            balance: {
                                increment: balanceChange
                            }
                        }
                    })
                )
            }
        }
        
        txOps.push(
            prisma.transaction.delete({
                where: { id }
            })
        )

        // Handle TransactionGroup updates if it belongs to one
        if (transaction.transaction_group_id && !skipGroupUpdate) {
            const group = await prisma.transactionGroup.findUnique({
                where: { id: transaction.transaction_group_id }
            });

            if (group) {
                if (group.installmentsCount > 1) {
                    txOps.push(
                        prisma.transactionGroup.update({
                            where: { id: group.id },
                            data: {
                                installmentsCount: { decrement: 1 },
                                totalAmount: { decrement: transaction.amount }
                            }
                        })
                    );
                } else {
                    txOps.push(
                        prisma.transactionGroup.delete({
                            where: { id: group.id }
                        })
                    );
                }
            }
        }

        await prisma.$transaction(txOps)
    }

    async changeTransactionStatus(data: ChangeTransactionStatusParams): Promise<void> {
        const { id, amount: amortizedAmount, totalValue, interest, discount, date, account_id } = data

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
            accountBalanceChange = totalValue
        } else if (existingTransaction.operation === 'expense') {
            // É uma despesa. Diminui o saldo.
            accountBalanceChange = -totalValue
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
                        amount: amortizedAmount, // Mantém o principal
                        totalValue: totalValue, // Salva o valor líquido com juros/descontos
                        interest: interest || 0,
                        discount: discount || 0,
                        data_vencimento: date, // Nova data de liquidação (data de liquidação efetiva)
                        confirmed: true, // Hardcoded: a função é para liquidar/confirmar
                        account_id: targetAccountId, // Atualiza a conta se mudou
                        ...(data.payment_method ? { payment_method: data.payment_method } : {})
                    },
                })

                // b) Atualiza o Saldo da Conta (da conta FINAL, onde o pagamento ocorreu)
                if (targetAccountId) {
                    await tx.account.update({
                        where: { id: targetAccountId },
                        data: {
                            balance: {
                                // Adiciona/Remove o valor liquidado do saldo existente
                                increment: accountBalanceChange,
                            },
                        },
                    })
                }
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
        
        // CORREÇÃO: Usar targetAmount para reversão (preferencial totalValue, senão amount)
        const targetAmount = existingTransaction.totalValue ?? existingTransaction.amount;

        if (existingTransaction.operation === 'income') {
            // Era receita (+). Reverter significa retirar do saldo (-).
            accountBalanceChange = -targetAmount
        } else if (existingTransaction.operation === 'expense') {
            // Era despesa (-). Reverter significa devolver ao saldo (+).
            accountBalanceChange = targetAmount
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
                        interest: 0,
                        discount: 0,
                        totalValue: null,
                        // Não alteramos a data. A data que estava vira a data de vencimento.
                    },
                })

                // b) Atualiza o Saldo da Conta
                if (targetAccountId) {
                    await tx.account.update({
                        where: { id: targetAccountId },
                        data: {
                            balance: {
                                increment: accountBalanceChange,
                            },
                        },
                    })
                }
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
    async findMany(month: Date, pageIndex?: number, perPage?: number, description?: string, value?: number, sector_id?: string, account_id?: string, status?: string, toDate?: Date, supplier_id?: string, operation?: string, fromDate?: Date, sortBy?: string, sortDirection?: string): Promise<GetTransactionsDTO | null> {

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
        } else if (status === 'overdue') {
            confirmedFilter = false;
        }

        const year = month.getFullYear()
        const monthNumber = month.getMonth() + 1

        // Define date filter logic
        let dateFilter: Prisma.DateTimeFilter<"Transaction"> | undefined;

        if (status === 'overdue') {
            // Regra estrita de vencimento: Tudo o que estiver pendente e com vencimento < HOJE 00:00:00
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            dateFilter = {
                lt: startOfToday
            }
        } else if (status === 'pending') {
            // Horizon Flow: "Todas as não pagas (independente data) + futuras até toDate"
            // Se confirmado = false, buscamos tudo <= toDate (que inclui passado + futuro próximo)
            // Se toDate não for passado, assumimos um padrão (ex: hoje + 7 dias)
            const targetDate = toDate ? new Date(toDate) : new Date(new Date().setDate(new Date().getDate() + 7));

            // Set end of day for targetDate to be inclusive
            targetDate.setHours(23, 59, 59, 999);

            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                dateFilter = {
                    gte: startDate,
                    lte: targetDate
                }
            } else {
                dateFilter = {
                    lte: targetDate
                }
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
                    credit_card_id: null
                },
                ...(sector !== undefined ? [{
                    sectors: {
                        id: { equals: sector }
                    }
                }] : []),
                ...(account !== undefined ? [{
                    accounts: {
                        id: { equals: account }
                    }
                }] : []),
                ...(supplier_id ? [{
                    supplier_id: { equals: supplier_id }
                }] : []),
                ...(description ? [{
                    description: {
                        contains: description,
                        mode: Prisma.QueryMode.insensitive
                    }
                }] : []),
                ...(value !== undefined && value !== null ? [{
                    amount: { equals: value }
                }] : []),
                ...(confirmedFilter !== undefined ? [{
                    confirmed: confirmedFilter
                }] : []),
                ...(operation ? [{
                    operation: { equals: operation }
                }] : [])
            ]
        }

        const totalCount = await prisma.transaction.count({
            where: whereConditions
        })

        const dtVencimentoOrder = sortBy === 'data_vencimento' ? sortDirection || 'asc' : undefined;
        let finalOrderBy: Prisma.TransactionOrderByWithRelationInput[] = [];

        // If a valid sort field is provided, it takes precedence
        if (sortBy === 'created_at') {
            finalOrderBy.push({ created_at: sortDirection as any || 'desc' });
        } else if (sortBy === 'data_vencimento') {
            finalOrderBy.push({ data_vencimento: sortDirection as any || 'asc' });
        } else if (sortBy === 'data_emissao') {
            finalOrderBy.push({ data_emissao: sortDirection as any || 'asc' });
        }

        // Add defaults at the end so it's a stable sort
        if (sortBy !== 'data_vencimento') finalOrderBy.push({ data_vencimento: 'asc' });
        if (sortBy !== 'created_at') finalOrderBy.push({ created_at: 'desc' });
        finalOrderBy.push({ id: 'asc' });

        const transactions = await prisma.transaction.findMany({
            skip, take,
            where: whereConditions,
            orderBy: finalOrderBy,
            include: {
                accounts: true,
                sectors: true,
                supplier: true
            }
        })

        // 🔥 Calculate and inject virtual invoices for any credit card purchases in this period
        const creditCardSwipes = await prisma.transaction.findMany({
            where: {
                credit_card_id: { not: null },
                data_vencimento: dateFilter
            },
            include: {
                creditCard: {
                    include: { account: true }
                }
            }
        })

        const aggregatedByCard = new Map<string, any>()
        for (const swipe of creditCardSwipes) {
            if (!swipe.credit_card_id || !swipe.creditCard) continue
            
            if (!aggregatedByCard.has(swipe.credit_card_id)) {
                aggregatedByCard.set(swipe.credit_card_id, {
                    id: `virtual-card-${swipe.credit_card_id}`,
                    operation: 'expense',
                    data_vencimento: swipe.data_vencimento,
                    data_emissao: swipe.data_emissao,
                    amount: 0,
                    interest: 0,
                    discount: 0,
                    totalValue: 0,
                    confirmed: true,
                    description: `Fatura Cartão: ${swipe.creditCard.name}`,
                    payment_method: 'CREDIT_CARD',
                    created_at: swipe.created_at,
                    accounts: swipe.creditCard.account,
                    account_id: swipe.creditCard.account_id,
                    credit_card_id: swipe.credit_card_id,
                    isVirtual: true,
                    swipes: []
                })
            }
            
            const grouped = aggregatedByCard.get(swipe.credit_card_id)
            grouped.amount += swipe.amount
            if (swipe.totalValue) {
                grouped.totalValue += swipe.totalValue
            } else {
                grouped.totalValue += swipe.amount
            }
            if (!swipe.confirmed) {
                grouped.confirmed = false
            }
            grouped.swipes.push(swipe)
        }

        const virtualRows = Array.from(aggregatedByCard.values())
        const combinedTransactions = [...transactions, ...virtualRows]

        combinedTransactions.sort((a, b) => {
            const dateA = new Date(a.data_vencimento).getTime()
            const dateB = new Date(b.data_vencimento).getTime()
            return dateA - dateB
        })

        return {
            transactions: combinedTransactions,
            totalCount: totalCount + virtualRows.length,
            perPage: take,
            pageIndex: pageIndex || 1
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
        
        // Remove valores nulos indesejados para não causar erro de tipagem no Prisma UncheckedInput
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        ) as Prisma.TransactionUncheckedCreateInput;

        const client = tx ?? prisma

        const transaction = await client.transaction.create({
            data: cleanData
        })

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
            // a) Atualiza status de todas e espelha o amount pro totalValue
            for (const transaction of transactionsToUpdate) {
                await tx.transaction.update({
                    where: { id: transaction.id },
                    data: {
                        confirmed: true,
                        totalValue: transaction.amount // Assume que pagou o valor de face exato
                    }
                });
            }

            // b) Atualiza saldo das contas
            for (const transaction of transactionsToUpdate) {
                let balanceChange = 0

                if (transaction.operation === 'income') {
                    balanceChange = transaction.amount
                } else if (transaction.operation === 'expense') {
                    balanceChange = -transaction.amount
                }
                if (balanceChange !== 0 && transaction.account_id) {
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
