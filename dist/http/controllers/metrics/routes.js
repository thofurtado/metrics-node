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

// src/http/controllers/metrics/routes.ts
var routes_exports = {};
__export(routes_exports, {
  metricsRoutes: () => metricsRoutes
});
module.exports = __toCommonJS(routes_exports);

// src/http/middlewares/verify-jwt.ts
async function verifyJWT(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ message: "Desautorizado" });
  }
}

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

// src/repositories/prisma/prisma-treatments-repository.ts
var PrismaTreatmentsRepository = class {
  async getMonthTreatmentsAmount() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const thisMonthTreatmentsAmount = await prisma.treatment.count({
      where: {
        AND: [
          {
            opening_date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              // Start of month
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
              // End of month (excluding the last day)
            }
          }
        ]
      }
    });
    const lastMonthTreatmentsAmount = await prisma.treatment.count({
      where: {
        AND: [
          {
            opening_date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1 - 1, 1),
              // Start of month
              lt: new Date(thisMonthYear, thisMonthNumber - 1, 1)
              // End of month (excluding the last day)
            }
          }
        ]
      }
    });
    const diffFromMonths = lastMonthTreatmentsAmount && thisMonthTreatmentsAmount ? thisMonthTreatmentsAmount * 100 / lastMonthTreatmentsAmount : null;
    return {
      amount: thisMonthTreatmentsAmount,
      diffFromLastMonth: diffFromMonths ? Number((diffFromMonths - 100).toFixed(2)) : 0
    };
  }
  async findByActive(pageIndex, perPage, treatmentId, clientName, status) {
    if (!pageIndex) pageIndex = 1;
    let take = 6;
    if (perPage) take = perPage;
    let skip = 0;
    if (pageIndex >= 1) {
      skip = pageIndex * take - take;
    }
    const whereConditions = {};
    if (treatmentId) {
      whereConditions.id = { contains: treatmentId };
    }
    if (clientName) {
      whereConditions.clients = {
        name: {
          contains: clientName,
          mode: "insensitive"
        }
      };
    }
    if (status && status !== "all") {
      whereConditions.status = { equals: status };
    } else if (!status || status === "all") {
      whereConditions.OR = [
        { status: { equals: "pending" } },
        { status: { equals: "in_progress" } },
        { status: { equals: "on_hold" } },
        { status: { equals: "follow_up" } },
        { status: { equals: "in_workbench" } },
        { status: { equals: "resolved" } },
        { status: { equals: "canceled" } }
      ];
    }
    const totalCount = await prisma.treatment.count({
      where: whereConditions
    });
    const treatmentsRaw = await prisma.treatment.findMany({
      skip,
      take,
      where: whereConditions,
      orderBy: [
        {
          opening_date: "asc"
        }
      ],
      include: {
        clients: true,
        items: {
          select: {
            quantity: true,
            salesValue: true,
            discount: true
          }
        }
      }
    });
    const treatments = treatmentsRaw.map((t) => {
      const amount = t.items.reduce((acc, item) => {
        const qty = item.quantity || 0;
        const val = item.salesValue || 0;
        const disc = item.discount || 0;
        return acc + (qty * val - disc);
      }, 0);
      return {
        ...t,
        amount: Number(amount.toFixed(2))
      };
    });
    return {
      treatments,
      // Cast to match DTO if necessary
      totalCount,
      perPage: take,
      pageIndex
    };
  }
  async create(data) {
    const treatment = await prisma.treatment.create({
      data
    });
    return treatment;
  }
  async findById(id) {
    const treatment = await prisma.treatment.findFirst({
      where: {
        id
      },
      include: {
        clients: true,
        equipments: true,
        items: {
          include: {
            items: true
          }
        },
        interactions: true
      }
    });
    if (!treatment) return null;
    const amount = treatment.items.reduce((acc, item) => {
      const qty = item.quantity || 0;
      const val = item.salesValue || 0;
      const disc = item.discount || 0;
      return acc + (qty * val - disc);
    }, 0);
    return {
      ...treatment,
      amount: Number(amount.toFixed(2))
    };
  }
  async update(id, data) {
    const updatedTreatment = await prisma.treatment.update({
      where: { id },
      data
    });
    return updatedTreatment;
  }
  async findByClient(client_id) {
    const treatments = await prisma.treatment.findMany({
      where: {
        client_id
      }
    });
    return treatments;
  }
  async findByStatus(status) {
    const treatments = prisma.treatment.findMany({
      where: {
        status
      },
      include: {
        users: true,
        equipments: true,
        items: true
      }
    });
    return treatments;
  }
  async close(id, tx) {
    const client = tx ?? prisma;
    const treatment = await client.treatment.update({
      where: { id },
      data: {
        ending_date: /* @__PURE__ */ new Date(),
        status: "resolved"
      }
    });
    return treatment;
  }
};

// src/use-cases/get-month-treatments-amount.ts
var GetMonthTreatmentsAmountUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute() {
    const metrics = await this.treatmentsRepository.getMonthTreatmentsAmount();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-treatments-amount.ts
function makeGetMonthTreatmentsAmountUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const getTreatmentProfileUseCase = new GetMonthTreatmentsAmountUseCase(treatmentsRepository);
  return getTreatmentProfileUseCase;
}

// src/http/controllers/metrics/getMonthTreatmentsAmount.ts
async function getMonthTreatmentsAmount(request, reply) {
  let monthTreatmentsAmount;
  try {
    const getMonthTreatmentsAmountUseCase = makeGetMonthTreatmentsAmountUseCase();
    monthTreatmentsAmount = await getMonthTreatmentsAmountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthTreatmentsAmount);
}

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

// src/use-cases/get-month-income-amount.ts
var GetMonthIncomeAmountUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthIncomeAmount();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-income-amount-use-case.ts
function MakeGetMonthIncomeAmountUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getTransactionProfileUseCase = new GetMonthIncomeAmountUseCase(transactionsRepository);
  return getTransactionProfileUseCase;
}

// src/http/controllers/metrics/getMonthIncomeAmount.ts
async function getMonthIncomeAmount(request, reply) {
  let monthIncomeAmount;
  try {
    const getMonthIncomeAmountUseCase = MakeGetMonthIncomeAmountUseCase();
    monthIncomeAmount = await getMonthIncomeAmountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthIncomeAmount);
}

// src/use-cases/get-month-expense-amount.ts
var GetMonthExpenseAmountUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthExpenseAmount();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-expense-amount-use-case.ts
function MakeGetMonthExpenseAmountUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getTransactionProfileUseCase = new GetMonthExpenseAmountUseCase(transactionsRepository);
  return getTransactionProfileUseCase;
}

// src/http/controllers/metrics/getMonthExpenseAmount.ts
async function getMonthExpenseAmount(request, reply) {
  let monthExpenseAmount;
  try {
    const getMonthExpenseAmountUseCase = MakeGetMonthExpenseAmountUseCase();
    monthExpenseAmount = await getMonthExpenseAmountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthExpenseAmount);
}

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

// src/http/controllers/metrics/getMonthIncomeByDay.ts
async function getMonthIncomeByDay(request, reply) {
  let monthIncomeByDay;
  try {
    const getMonthIncomeByDayUseCase = MakeGetMonthByDaysUseCase();
    monthIncomeByDay = await getMonthIncomeByDayUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthIncomeByDay);
}

// src/use-cases/get-month-expense-by-sector.ts
var GetMonthExpenseBySectorUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthExpenseBySector();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-expense-by-sector.ts
function MakeGetMonthExpenseBySectorUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getMonthExpenseBySectorUseCase = new GetMonthExpenseBySectorUseCase(transactionsRepository);
  return getMonthExpenseBySectorUseCase;
}

// src/http/controllers/metrics/getMonthExpenseBySector.ts
async function getMonthExpenseBySector(request, reply) {
  let monthExpenseBySector;
  try {
    const getMonthExpenseBySectorUseCase = MakeGetMonthExpenseBySectorUseCase();
    monthExpenseBySector = await getMonthExpenseBySectorUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthExpenseBySector);
}

// src/use-cases/get-general-balance.ts
var GetGeneralBalanceUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getBalance();
    return metrics;
  }
};

// src/use-cases/factories/make-get-general-balance.ts
function MakeGetGeneralBalanceUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getGeneralBalanceUseCase = new GetGeneralBalanceUseCase(transactionsRepository);
  return getGeneralBalanceUseCase;
}

// src/http/controllers/metrics/getGeneralBalance.ts
async function getGeneralBalance(request, reply) {
  let genetalBalance;
  try {
    const getGeneralBalance2 = MakeGetGeneralBalanceUseCase();
    genetalBalance = await getGeneralBalance2.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(genetalBalance);
}

// src/repositories/prisma/prisma-balance-projection-repository.ts
var PrismaBalanceProjectionRepository = class {
  async getBalanceProjection(days = 30) {
    const currentDate = /* @__PURE__ */ new Date();
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const accounts = await prisma.account.findMany({
      select: {
        balance: true
      }
    });
    const currentBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const futureTransactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: today,
          // Apenas a partir de hoje
          lte: endDate
        }
      },
      select: {
        date: true,
        operation: true,
        amount: true,
        confirmed: true
      },
      orderBy: {
        date: "asc"
      }
    });
    const dailyBalances = this.generateDailyBalances(
      currentBalance,
      today,
      endDate,
      futureTransactions
    );
    return {
      currentBalance,
      dailyBalances
    };
  }
  generateDailyBalances(initialBalance, startDate, endDate, transactions) {
    const dailyBalances = [];
    let runningBalance = initialBalance;
    const today = /* @__PURE__ */ new Date();
    const todayString = today.toISOString().split("T")[0];
    const todayTransactions = transactions.filter(
      (t) => new Date(t.date).toISOString().split("T")[0] === todayString
    );
    const todayBalanceChange = todayTransactions.reduce((sum, transaction) => {
      if (transaction.operation === "income") {
        return sum + transaction.amount;
      } else {
        return sum - transaction.amount;
      }
    }, 0);
    runningBalance += todayBalanceChange;
    dailyBalances.push({
      date: todayString,
      balance: runningBalance,
      isProjection: todayTransactions.some((t) => !t.confirmed)
      // Projeção se tiver pendentes
    });
    const transactionsByDate = /* @__PURE__ */ new Map();
    transactions.forEach((transaction) => {
      const dateString = new Date(transaction.date).toISOString().split("T")[0];
      if (!transactionsByDate.has(dateString)) {
        transactionsByDate.set(dateString, []);
      }
      transactionsByDate.get(dateString).push(transaction);
    });
    const uniqueDates = Array.from(transactionsByDate.keys()).filter((dateString) => dateString !== todayString).sort();
    const limitedDates = uniqueDates.slice(0, 29);
    limitedDates.forEach((dateString) => {
      const dayTransactions = transactionsByDate.get(dateString) || [];
      const dayBalanceChange = dayTransactions.reduce((sum, transaction) => {
        if (transaction.operation === "income") {
          return sum + transaction.amount;
        } else {
          return sum - transaction.amount;
        }
      }, 0);
      runningBalance += dayBalanceChange;
      const date = new Date(dateString);
      const isFutureDate = date > today;
      const hasPendingTransactions = dayTransactions.some((t) => !t.confirmed);
      const isProjection = isFutureDate || hasPendingTransactions;
      dailyBalances.push({
        date: dateString,
        balance: runningBalance,
        isProjection
      });
    });
    return dailyBalances;
  }
};

// src/use-cases/get-balance-projection.ts
var GetBalanceProjectionUseCase = class {
  constructor(balanceProjectionRepository) {
    this.balanceProjectionRepository = balanceProjectionRepository;
  }
  async execute({ days = 30 } = {}) {
    const projection = await this.balanceProjectionRepository.getBalanceProjection(days);
    return { projection };
  }
};

// src/use-cases/factories/make-get-balance-projection-use-case.ts
function MakeGetBalanceProjectionUseCase() {
  const balanceProjectionRepository = new PrismaBalanceProjectionRepository();
  const getBalanceProjectionUseCase = new GetBalanceProjectionUseCase(balanceProjectionRepository);
  return getBalanceProjectionUseCase;
}

// src/http/controllers/metrics/get-balance-projection.ts
async function getBalanceProjection(request, reply) {
  let projection;
  try {
    const days = request.query.days ? parseInt(request.query.days) : void 0;
    const getBalanceProjectionUseCase = MakeGetBalanceProjectionUseCase();
    projection = await getBalanceProjectionUseCase.execute({ days });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(projection);
}

// src/http/controllers/metrics/routes.ts
async function metricsRoutes(app) {
  app.addHook("onRequest", verifyJWT);
  app.get("/metrics/month-treatments-amount", getMonthTreatmentsAmount);
  app.get("/metrics/month-income-amount", getMonthIncomeAmount);
  app.get("/metrics/month-expense-amount", getMonthExpenseAmount);
  app.get("/metrics/month-income-by-days", getMonthIncomeByDay);
  app.get("/metrics/month-expense-by-sector", getMonthExpenseBySector);
  app.get("/metrics/general-balance", getGeneralBalance);
  app.get("/balance-projection", getBalanceProjection);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  metricsRoutes
});
