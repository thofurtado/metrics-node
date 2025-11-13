import { Prisma, Transaction } from '@prisma/client'
import { TransactionsRepository } from '../transactions-repository'
import { prisma } from '@/lib/prisma'
import { GetTransactionsDTO } from '../DTO/get-transactions-dto'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'






export class PrismaTransactionsRepository implements TransactionsRepository {
    // Versão otimizada com Promise.all (mais rápida)
    async getFinancialSummary(): Promise<{
        totalBalance: number;
        monthlyIncome: number;
        monthlyExpenses: number;
        pendingIncome: number;
        pendingExpenses: number;
        overdueIncome: number;    // A receber vencido (todos os meses)
        overdueExpenses: number;  // A pagar vencido (todos os meses)
    }> {
        const currentDate = new Date();
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
                    date: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // Saídas totais do mês
            prisma.transaction.aggregate({
                where: {
                    operation: 'expense',
                    date: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // A receber do mês (pendentes)
            prisma.transaction.aggregate({
                where: {
                    operation: 'income',
                    confirmed: false,
                    date: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // A pagar do mês (pendentes)
            prisma.transaction.aggregate({
                where: {
                    operation: 'expense',
                    confirmed: false,
                    date: { gte: startOfMonth, lt: startOfNextMonth }
                },
                _sum: { amount: true }
            }),
            // 🔥 CORREÇÃO: A receber vencido (usando startOfToday)
            prisma.transaction.aggregate({
                where: {
                    operation: 'income',
                    confirmed: false,
                    date: { lt: startOfToday } // Data menor que HOJE 00:00 = vencido
                },
                _sum: { amount: true }
            }),
            // 🔥 CORREÇÃO: A pagar vencido (usando startOfToday)
            prisma.transaction.aggregate({
                where: {
                    operation: 'expense',
                    confirmed: false,
                    date: { lt: startOfToday } // Data menor que HOJE 00:00 = vencido
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
        const totalExpense = await prisma.transaction.aggregate({
            where: {
                AND: [
                    {
                        operation: 'expense',
                    },
                    {
                        confirmed: true
                    }
                ]
            },
            _sum: {
                amount: true // Include amount field in the sum
            }
        })
        const totalRenevue = await prisma.transaction.aggregate({
            where: {
                AND: [
                    {
                        operation: 'income',
                    },
                    {
                        confirmed: true
                    }
                ]
            },
            _sum: {
                amount: true // Include amount field in the sum
            }
        })

        const balance = Number(totalRenevue ? totalRenevue._sum.amount : 0) - Number(totalExpense ? totalExpense._sum.amount : 0)
        return balance

    }
    async getMonthIncomeByDays(): Promise<{ day: string; revenue: number; }[]> {
        const month = new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1

        const dailyIncomes = await prisma.transaction.groupBy({
            by: ['date'],
            _sum: {
                amount: true,
            },
            where: {
                AND: [
                    {
                        date: {
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
                date: 'asc'
            }
        })

        return dailyIncomes.map((income) => ({
            day: income.date.toISOString().substring(5, 10),
            revenue: income._sum.amount || 0, // Garante que não seja null
        }))
    }
    async getMonthExpenseBySector(): Promise<{ sector_name: string; amount: number; }[]> {
        const month = new Date()
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
                        date: {
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
    async getMonthExpenseAmount(): Promise<{
        monthExpenseAmount: number;
        diffFromLastMonth: number;
        alreadyPaid: number
    }> {
        const month = new Date()
        const thisMonthYear = month.getFullYear()
        const thisMonthNumber = month.getMonth() + 1

        const thisMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
            _sum: {
                amount: true
            },
            where: {
                AND: [
                    {
                        date: {
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
                        date: {
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
                        date: {
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
    async getMonthIncomeAmount(): Promise<{
        monthIncomeAmount: number;
        diffFromLastMonth: number;
        alreadyPaid: number
    }> {
        const month = new Date()
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
                        date: {
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
                        date: {
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
                        date: {
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
        const findedTransaction = await prisma.transaction.findFirst({ where: { id } })
        if (findedTransaction) {
            await prisma.transaction.delete({
                where: { id }
            })
        }
    }

    async changeTransactionStatus(id: string): Promise<void> {
        // 1. Busca a transação de forma única e verifica a existência
        // 'update' é usado aqui porque é mais atômico para o que queremos fazer

        const findedTransaction = await prisma.transaction.findUnique({
            where: { id },
            select: { confirmed: true } // Seleciona apenas o campo 'confirmed' para eficiência
        })

        if (!findedTransaction) {
            // Lança um erro se a transação não for encontrada
            throw new ResourceNotFoundError()
        }

        // 2. Executa a atualização, invertendo o status
        await prisma.transaction.update({
            where: { id },
            data: {
                confirmed: !findedTransaction.confirmed // Inverte o valor booleano
            }
        })
    }

    async update(data: Prisma.TransactionUncheckedUpdateInput): Promise<{
        id: string;
        operation: string;
        date: Date;
        amount: number;
        account_id: string;
        sector_id: string | null;
        description: string | null;
        confirmed: boolean
    }> {
        // Verifica se o ID foi fornecido
        if (!data.id) {
            throw new Error('Transaction ID is required for update');
        }

        // CORREÇÃO: Preparar os dados de atualização sem as relações
        const updateData: Prisma.TransactionUncheckedUpdateInput = {
            operation: data.operation,
            date: data.date,
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

        return {
            id: updatedTransaction.id,
            operation: updatedTransaction.operation,
            date: updatedTransaction.date,
            amount: updatedTransaction.amount,
            account_id: updatedTransaction.account_id,
            sector_id: updatedTransaction.sector_id,
            description: updatedTransaction.description,
            confirmed: updatedTransaction.confirmed
        };
    }
    async findMany(month: Date, pageIndex?: number, perPage?: number, description?: string, value?: number, sector_id?: string, account_id?: string): Promise<GetTransactionsDTO | null> {

        if (!pageIndex)
            pageIndex = 1
        let take = 6
        if (perPage)
            take = perPage
        let skip: number = 0
        if (pageIndex >= 1) {
            skip = (pageIndex * take) - take
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
        //const year = month.getFullYear()
        const year = month.getFullYear()
        const monthNumber = month.getMonth() + 1
        const totalCount = await prisma.transaction.count({
            where: {
                AND: [
                    {
                        date: {
                            gte: new Date(year, monthNumber - 1, 1), // Start of month
                            lt: new Date(year, monthNumber, 1), // End of month (excluding the last day)
                        },
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
                        description: {
                            contains: description,
                            mode: 'insensitive'
                        }
                    },
                    {
                        amount: {
                            equals: value
                        }
                    }
                ]
            }
        })



        const transactions = await prisma.transaction.findMany({
            skip, take,
            where: {
                AND: [
                    {
                        date: {
                            gte: new Date(year, monthNumber - 1, 1), // Start of month
                            lt: new Date(year, monthNumber, 1), // End of month (excluding the last day)
                        },
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
                        description: {
                            contains: description,
                            mode: 'insensitive'
                        }
                    },
                    {
                        amount: {
                            equals: value
                        }
                    }
                ]
            },
            orderBy: [
                {
                    date: 'asc'
                }
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

    async create(data: Prisma.TransactionUncheckedCreateInput) {
        if (!data.date) {
            data.date = new Date()
        }
        if (!data.confirmed) {
            data.confirmed = false
        }
        const createTransaction = {
            ...data,
            account_id: undefined,
            sector_id: undefined
        }
        let transaction
        if (!data.sector_id) {
            transaction = await prisma.transaction.create({
                data: {
                    ...createTransaction,
                    accounts: {
                        connect: { id: data.account_id }
                    }
                }

            })
        } else {
            transaction = await prisma.transaction.create({
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

}
