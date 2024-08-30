import { Prisma, Transaction } from '@prisma/client'
import { TransactionsRepository } from '../transactions-repository'
import { prisma } from '@/lib/prisma'
import { GetTransactionsDTO } from '../DTO/get-transactions-dto'






export class PrismaTransactionsRepository implements TransactionsRepository {
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
    async getMonthIncomeByDays(): Promise<[{ day: string; revenue: number; }]> {
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
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, thisMonthNumber, 1) // Add 1 day to include the last day
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
            day: income.date.toISOString().substring(5, 10), // Format date as YYYY-MM-DD
            revenue: income._sum.amount,
        }))
    }
    async getMonthExpenseBySector(): Promise<[{ sector_name: string; amount: number; }]> {
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
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, thisMonthNumber, 1)// Add 1 day to include the last day
                        },
                    },
                    {
                        operation: 'expense',
                    },
                ],
            },

        })

        const sectorIds = sectorExpenses.map((expense) => expense.sector_id) // Extract sector IDs

        // Use Promise.all to execute sector lookups in parallel
        const sectors = await Promise.all(
            sectorIds.map((id) => prisma.sector.findFirst({ where: { id } }))
        )

        // Destructure sector names from the fetched sectors
        const sectorNames = sectors.map((sector) => sector?.name || '') // Handle missing sectors

        return sectorExpenses.map((expense, index) => ({
            sector_name: sectorNames[index],
            amount: Number(expense._sum.amount?.toFixed(2)),
        }))
    }
    async getMonthExpenseAmount(): Promise<{ monthExpenseAmount: number; diffFromLastMonth: number; alreadyPaid: number }> {
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
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, thisMonthNumber, 1), // End of month (excluding the last day)
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
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, thisMonthNumber, 1), // End of month (excluding the last day)
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
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1), // End of month (excluding the last day)
                        },
                    },
                    {
                        operation: 'expense'
                    }
                ]
            }
        })



        const diffFromMonths = lastMonthTransactionsAmount && thisMonthTransactionsAmount ?
            (thisMonthTransactionsAmount._sum.amount * 100) / lastMonthTransactionsAmount._sum.amount : null

        return {
            monthExpenseAmount: thisMonthTransactionsAmount._sum.amount,
            alreadyPaid: thisMonthTransactionsPaidAmount._sum.amount,
            diffFromLastMonth: diffFromMonths ? Number((diffFromMonths - 100).toFixed(2)) : 0
        }
    }
    async getMonthIncomeAmount(): Promise<{ monthIncomeAmount: number; diffFromLastMonth: number; alreadyPaid: number }> {
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
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, thisMonthNumber, 1), // End of month (excluding the last day)
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
                            gte: new Date(thisMonthYear, thisMonthNumber - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, thisMonthNumber, 1), // End of month (excluding the last day)
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
                            gte: new Date(thisMonthYear, (thisMonthNumber - 1) - 1, 1), // Start of month
                            lt: new Date(thisMonthYear, (thisMonthNumber - 1), 1), // End of month (excluding the last day)
                        },
                    },
                    {
                        operation: 'income'
                    }
                ]
            }
        })

        const diffFromMonths = lastMonthTransactionsAmount && thisMonthTransactionsAmount ?
            (thisMonthTransactionsAmount._sum.amount * 100) / lastMonthTransactionsAmount._sum.amount : null

        return {
            monthIncomeAmount: thisMonthTransactionsAmount._sum.amount,
            alreadyPaid: thisMonthTransactionsPaidAmount._sum.amount,
            diffFromLastMonth: diffFromMonths ? Number((diffFromMonths - 100).toFixed(2)) : 0
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
        const findedTransaction = await prisma.transaction.findFirst({ where: { id } })
        if (findedTransaction?.confirmed) {
            await prisma.transaction.update({
                where: { id },
                data: {
                    confirmed: false
                }
            })
        } else {
            await prisma.transaction.update({
                where: { id },
                data: {
                    confirmed: true
                }
            })
        }
    }

    update(data: Prisma.TransactionUncheckedUpdateInput): Promise<{ id: string; operation: string; date: Date; amount: number; account_id: string; sector_id: string | null; description: string | null; confirmed: boolean }> {
        throw new Error('Method not implemented.')
    }
    // findMany(operation?: string | undefined, paid?: boolean | undefined, sector_id?: string | undefined, account_id?: string | undefined): Promise<{ id: string; operation: string; date: Date; amount: number; account_id: string; sector_id: string | null; description: string | null; confirmed: boolean }[] | null> {
    //     const transactions = prisma.transaction.findMany()
    //     return transactions
    // }
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
