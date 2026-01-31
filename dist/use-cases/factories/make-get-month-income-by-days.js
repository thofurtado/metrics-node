"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/use-cases/factories/make-get-month-income-by-days.ts
var make_get_month_income_by_days_exports = {};
__export(make_get_month_income_by_days_exports, {
  MakeGetMonthByDaysUseCase: () => MakeGetMonthByDaysUseCase
});
module.exports = __toCommonJS(make_get_month_income_by_days_exports);

// src/lib/prisma.ts
var import_client = require("@prisma/client");

// src/env/index.ts
var import_config = require("dotenv/config");
var import_zod = require("zod");
var envSchema = import_zod.z.object({
  // Quais são as opções de ambiente para o node rodar
  NODE_ENV: import_zod.z.enum(["dev", "test", "production"]).default("dev"),
  // chave secreta
  JWT_SECRET: import_zod.z.string(),
  // coerce força a conversão, fazendo com que mesmo que seja string, entre como numero a porta
  PORT: import_zod.z.coerce.number().default(3333)
});
var _env = envSchema.safeParse(process.env);
if (_env.success == false) {
  console.error(" Invalid environment variables", _env.error.format());
  throw new Error("Invalid environment variables");
}
var env = _env.data;

// src/lib/prisma.ts
var prisma = new import_client.PrismaClient({
  log: env.NODE_ENV == "dev" ? ["query"] : []
});

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/repositories/prisma/prisma-transactions-repository.ts
var PrismaTransactionsRepository = class {
  // Versão otimizada com Promise.all (mais rápida)
  async getFinancialSummary() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const startOfToday = new Date(currentDate);
    startOfToday.setHours(0, 0, 0, 0);
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
          operation: "income",
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // Saídas totais do mês
      prisma.transaction.aggregate({
        where: {
          operation: "expense",
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // A receber do mês (pendentes)
      prisma.transaction.aggregate({
        where: {
          operation: "income",
          confirmed: false,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // A pagar do mês (pendentes)
      prisma.transaction.aggregate({
        where: {
          operation: "expense",
          confirmed: false,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // 🔥 CORREÇÃO: A receber vencido (usando startOfToday)
      prisma.transaction.aggregate({
        where: {
          operation: "income",
          confirmed: false,
          date: { lt: startOfToday }
          // Data menor que HOJE 00:00 = vencido
        },
        _sum: { amount: true }
      }),
      // 🔥 CORREÇÃO: A pagar vencido (usando startOfToday)
      prisma.transaction.aggregate({
        where: {
          operation: "expense",
          confirmed: false,
          date: { lt: startOfToday }
          // Data menor que HOJE 00:00 = vencido
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
      overdueIncome: overdueIncomeResult._sum.amount || 0,
      // A receber vencido
      overdueExpenses: overdueExpensesResult._sum.amount || 0
      // A pagar vencido
    };
  }
  async getBalance() {
    const balanceResult = await prisma.account.aggregate({
      _sum: {
        balance: true
      }
    });
    return Number(balanceResult._sum.balance) || 0;
  }
  async getMonthIncomeByDays() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const dailyIncomes = await prisma.transaction.groupBy({
      by: ["date"],
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "income"
          }
        ]
      },
      orderBy: {
        date: "asc"
      }
    });
    return dailyIncomes.map((income) => ({
      day: income.date.toISOString().substring(5, 10),
      revenue: income._sum.amount || 0
      // Garante que não seja null
    }));
  }
  async getMonthExpenseBySector() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const sectorExpenses = await prisma.transaction.groupBy({
      by: ["sector_id"],
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const sectorIds = sectorExpenses.map((expense) => expense.sector_id);
    const validSectorIds = sectorIds.filter((id) => id !== null);
    const sectors = await Promise.all(
      validSectorIds.map((id) => prisma.sector.findFirst({ where: { id } }))
    );
    return sectorExpenses.map((expense) => {
      if (expense.sector_id === null) {
        return {
          sector_name: "Sem setor",
          amount: Number((expense._sum.amount || 0).toFixed(2))
        };
      }
      const sectorIndex = validSectorIds.indexOf(expense.sector_id);
      const sectorName = sectorIndex !== -1 ? sectors[sectorIndex]?.name : "Setor n\xE3o encontrado";
      return {
        sector_name: sectorName || "Setor n\xE3o encontrado",
        amount: Number((expense._sum.amount || 0).toFixed(2))
      };
    });
  }
  async getMonthExpenseAmount() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const thisMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            confirmed: true
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const thisMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const lastMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1 - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber - 1, 1)
            }
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const thisMonthAmount = thisMonthTransactionsAmount._sum.amount || 0;
    const lastMonthAmount = lastMonthTransactionsAmount._sum.amount || 0;
    const alreadyPaid = thisMonthTransactionsPaidAmount._sum.amount || 0;
    let diffFromLastMonth = 0;
    if (lastMonthAmount > 0) {
      diffFromLastMonth = Number(((thisMonthAmount - lastMonthAmount) / lastMonthAmount * 100).toFixed(2));
    } else if (thisMonthAmount > 0) {
      diffFromLastMonth = 100;
    }
    return {
      monthExpenseAmount: thisMonthAmount,
      alreadyPaid,
      diffFromLastMonth
    };
  }
  async getMonthIncomeAmount() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const thisMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            confirmed: true
          },
          {
            operation: "income"
          }
        ]
      }
    });
    const thisMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "income"
          }
        ]
      }
    });
    const lastMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1 - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber - 1, 1)
            }
          },
          {
            operation: "income"
          }
        ]
      }
    });
    const thisMonthAmount = thisMonthTransactionsAmount._sum.amount || 0;
    const lastMonthAmount = lastMonthTransactionsAmount._sum.amount || 0;
    const alreadyPaid = thisMonthTransactionsPaidAmount._sum.amount || 0;
    let diffFromLastMonth = 0;
    if (lastMonthAmount > 0) {
      diffFromLastMonth = Number(((thisMonthAmount - lastMonthAmount) / lastMonthAmount * 100).toFixed(2));
    } else if (thisMonthAmount > 0) {
      diffFromLastMonth = 100;
    }
    return {
      monthIncomeAmount: thisMonthAmount,
      alreadyPaid,
      diffFromLastMonth
    };
  }
  async delete(id) {
    const findedTransaction = await prisma.transaction.findFirst({ where: { id } });
    if (findedTransaction) {
      await prisma.transaction.delete({
        where: { id }
      });
    }
  }
  async changeTransactionStatus(data) {
    const { id, amount: newAmount, date, account_id } = data;
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id }
    });
    if (!existingTransaction) {
      throw new ResourceNotFoundError();
    }
    if (existingTransaction.confirmed) {
      return;
    }
    let accountBalanceChange = 0;
    if (existingTransaction.operation === "income") {
      accountBalanceChange = newAmount;
    } else if (existingTransaction.operation === "expense") {
      accountBalanceChange = -newAmount;
    }
    const targetAccountId = account_id || existingTransaction.account_id;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id },
          data: {
            amount: newAmount,
            // Novo valor (pago parcial ou total)
            date,
            // Nova data de liquidação (data de liquidação efetiva)
            confirmed: true,
            // Hardcoded: a função é para liquidar/confirmar
            account_id: targetAccountId
            // Atualiza a conta se mudou
          }
        });
        await tx.account.update({
          where: { id: targetAccountId },
          data: {
            balance: {
              // Adiciona/Remove o valor liquidado do saldo existente
              increment: accountBalanceChange
            }
          }
        });
      });
    } catch (error) {
      console.error("Erro na transa\xE7\xE3o de liquida\xE7\xE3o:", error);
      throw new Error("Falha ao liquidar a transa\xE7\xE3o e atualizar o saldo da conta.");
    }
  }
  async update(data) {
    if (!data.id) {
      throw new Error("Transaction ID is required for update");
    }
    const updateData = {
      operation: data.operation,
      date: data.date,
      amount: data.amount,
      description: data.description,
      confirmed: data.confirmed
    };
    if (data.account_id !== void 0) {
      updateData.account_id = data.account_id;
    }
    if (data.sector_id !== void 0) {
      updateData.sector_id = data.sector_id;
    }
    const updatedTransaction = await prisma.transaction.update({
      where: {
        id: data.id
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
      confirmed: updatedTransaction.confirmed,
      created_at: updatedTransaction.created_at
    };
  }
  async findMany(month, pageIndex, perPage, description, value, sector_id, account_id, status, toDate) {
    if (!pageIndex)
      pageIndex = 1;
    let take = 6;
    if (perPage)
      take = perPage;
    let skip = 0;
    if (pageIndex >= 1) {
      skip = pageIndex * take - take;
    }
    let sector;
    if (sector_id === "all") {
      sector = void 0;
    } else {
      sector = sector_id;
    }
    let account;
    if (account_id === "all") {
      account = void 0;
    } else {
      account = account_id;
    }
    let confirmedFilter = void 0;
    if (status === "pending") {
      confirmedFilter = false;
    } else if (status === "completed") {
      confirmedFilter = true;
    }
    const year = month.getFullYear();
    const monthNumber = month.getMonth() + 1;
    let dateFilter;
    if (status === "pending") {
      const targetDate = toDate || new Date((/* @__PURE__ */ new Date()).setDate((/* @__PURE__ */ new Date()).getDate() + 7));
      targetDate.setHours(23, 59, 59, 999);
      dateFilter = {
        lte: targetDate
      };
    } else {
      dateFilter = {
        gte: new Date(year, monthNumber - 1, 1),
        // Start of month
        lt: new Date(year, monthNumber, 1)
        // End of month (excluding the last day)
      };
    }
    const whereConditions = {
      AND: [
        {
          date: dateFilter
          // Use dynamic date filter
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
            mode: "insensitive"
          }
        },
        {
          amount: {
            equals: value
          }
        },
        // Add confirmed filter if status is provided
        ...confirmedFilter !== void 0 ? [{ confirmed: confirmedFilter }] : []
      ]
    };
    const totalCount = await prisma.transaction.count({
      where: whereConditions
    });
    const transactions = await prisma.transaction.findMany({
      skip,
      take,
      where: whereConditions,
      orderBy: [
        {
          date: "asc"
        }
      ],
      include: {
        accounts: true,
        sectors: true
      }
    });
    return {
      transactions,
      totalCount,
      perPage: take,
      pageIndex
    };
  }
  async findById(id) {
    const transaction = prisma.transaction.findFirst({
      where: {
        id
      }
    });
    return transaction;
  }
  async create(data, tx) {
    if (!data.date) {
      data.date = /* @__PURE__ */ new Date();
    }
    if (!data.confirmed) {
      data.confirmed = false;
    }
    const createTransaction = {
      ...data,
      account_id: void 0,
      sector_id: void 0
    };
    const client = tx ?? prisma;
    let transaction;
    if (!data.sector_id) {
      transaction = await client.transaction.create({
        data: {
          ...createTransaction,
          accounts: {
            connect: { id: data.account_id }
          }
        }
      });
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
      });
    }
    return transaction;
  }
};

// src/use-cases/get-month-income-by-days.ts
var GetMonthIncomeByDaysUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthIncomeByDays();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-income-by-days.ts
function MakeGetMonthByDaysUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getMonthIncomeByDaysUseCase = new GetMonthIncomeByDaysUseCase(transactionsRepository);
  return getMonthIncomeByDaysUseCase;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakeGetMonthByDaysUseCase
});
