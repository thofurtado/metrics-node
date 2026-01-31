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

// src/http/controllers/financial/routes.ts
var routes_exports = {};
__export(routes_exports, {
  financialRoutes: () => financialRoutes
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

// src/http/controllers/financial/sector.ts
var import_zod2 = require("zod");

// src/use-cases/errors/this-name-already-exists-error.ts
var ThisNameAlreadyExistsError = class extends Error {
  constructor() {
    super("Nome j\xE1 cadastrado");
  }
};

// src/use-cases/errors/invalid-option-error.ts
var InvalidOptionError = class extends Error {
  constructor() {
    super("Op\xE7\xE3o invalida");
  }
};

// src/use-cases/sector.ts
var SectorUseCase = class {
  constructor(sectorsRepository) {
    this.sectorsRepository = sectorsRepository;
  }
  async execute({
    name,
    budget,
    type
  }) {
    const sectorWithSameName = await this.sectorsRepository.findByName(name);
    if (sectorWithSameName !== null) {
      throw new ThisNameAlreadyExistsError();
    }
    if (type !== "in" && type !== "out") {
      throw new InvalidOptionError();
    }
    const sector = await this.sectorsRepository.create({
      name,
      budget,
      type
    });
    return {
      sector
    };
  }
};

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

// src/repositories/prisma/prisma-sectors-repository.ts
var PrismaSectorsRepository = class {
  async findByName(name) {
    const sector = prisma.sector.findFirst({
      where: {
        name
      }
    });
    if (!sector) {
      return null;
    }
    return sector;
  }
  async create(data) {
    const sector = prisma.sector.create({
      data
    });
    return sector;
  }
  update(data) {
    throw new Error("Method not implemented.");
  }
  findById(id) {
    const sector = prisma.sector.findFirst({
      where: { id }
    });
    return sector;
  }
  async findMany() {
    const sectors = await prisma.sector.findMany({
      orderBy: [
        {
          name: "asc"
        }
      ]
    });
    return sectors;
  }
  compareBudget(month, sector_id) {
    throw new Error("Method not implemented.");
  }
};

// src/use-cases/factories/make-sector-use-case.ts
function MakeSectorUseCase() {
  const sectorsRepository = new PrismaSectorsRepository();
  const sectorUseCase = new SectorUseCase(sectorsRepository);
  return sectorUseCase;
}

// src/http/controllers/financial/sector.ts
async function createSector(request, reply) {
  try {
    console.log("[CreateSector] Payload:", JSON.stringify(request.body, null, 2));
    const registerBodySchema = import_zod2.z.object({
      name: import_zod2.z.string(),
      budget: import_zod2.z.number().nullable().optional(),
      type: import_zod2.z.string()
    });
    const { name, budget, type } = registerBodySchema.parse(request.body);
    const sectorUseCase = MakeSectorUseCase();
    const { sector } = await sectorUseCase.execute({
      name,
      budget: budget ?? void 0,
      type
    });
    return reply.status(201).send(sector);
  } catch (err) {
    console.error("[CreateSector] Error:", err);
    if (err instanceof import_zod2.z.ZodError) {
      return reply.status(400).send({ message: "Validation error", issues: err.format() });
    }
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

// src/use-cases/get-sectors.ts
var GetSectorsUseCase = class {
  constructor(sectorsRepository) {
    this.sectorsRepository = sectorsRepository;
  }
  async execute() {
    const sectors = await this.sectorsRepository.findMany();
    return {
      sectors
    };
  }
};

// src/use-cases/factories/make-get-sectors-use-case.ts
function MakeGetSectorsUseCase() {
  const sectorsRepository = new PrismaSectorsRepository();
  const getSectorUseCase = new GetSectorsUseCase(sectorsRepository);
  return getSectorUseCase;
}

// src/http/controllers/financial/getSector.ts
async function getSector(request, reply) {
  let sectors;
  try {
    const getSectorUseCase = MakeGetSectorsUseCase();
    sectors = await getSectorUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(sectors);
}

// src/repositories/prisma/prisma-accounts-repository.ts
var PrismaAccountsRepository = class {
  async findMany() {
    const accounts = await prisma.account.findMany({
      orderBy: [
        {
          name: "asc"
        }
      ]
    });
    return accounts;
  }
  async create(data) {
    const account = await prisma.account.create({
      data
    });
    return account;
  }
  async findByName(name) {
    const account = await prisma.account.findFirst({
      where: {
        name
      }
    });
    return account;
  }
  async findById(id) {
    const account = await prisma.account.findUnique({
      where: {
        id
      }
    });
    return account;
  }
  async changeBalance(id, value, operationType, tx) {
    const client = tx ?? prisma;
    try {
      await client.account.update({
        where: { id },
        data: {
          balance: {
            increment: operationType ? value : -value
          }
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  async update(id, data) {
    const updatedAccount = await prisma.account.update({
      where: { id },
      data
    });
    return updatedAccount;
  }
  async delete(id) {
    await prisma.account.delete({
      where: { id }
    });
  }
};

// src/use-cases/errors/only-natural-numbers-error.ts
var OnlyNaturalNumbersError = class extends Error {
  constructor() {
    super("Apenas numeros naturais");
  }
};

// src/use-cases/account.ts
var AccountUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({
    name,
    description,
    goal,
    balance
  }) {
    const accountWithSameName = await this.accountsRepository.findByName(name);
    if (accountWithSameName !== null) {
      throw new ThisNameAlreadyExistsError();
    }
    if (balance < 0) {
      throw new OnlyNaturalNumbersError();
    }
    const account = await this.accountsRepository.create({
      name,
      description,
      goal,
      balance
    });
    return {
      account
    };
  }
};

// src/use-cases/factories/make-account-use-case.ts
function MakeAccountUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const accountUseCase = new AccountUseCase(accountsRepository);
  return accountUseCase;
}

// src/http/controllers/financial/account.ts
var import_zod3 = require("zod");
async function createAccount(request, reply) {
  const registerBodySchema = import_zod3.z.object({
    name: import_zod3.z.string(),
    balance: import_zod3.z.number(),
    description: import_zod3.z.string().nullish(),
    goal: import_zod3.z.number().nullish()
  });
  const { name, description, balance, goal } = registerBodySchema.parse(request.body);
  let account;
  try {
    const accountUseCase = MakeAccountUseCase();
    account = await accountUseCase.execute({
      name,
      description: description || null,
      balance,
      goal: goal || null
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(account);
}

// src/use-cases/get-accounts.ts
var GetAccountsUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute() {
    const accounts = await this.accountsRepository.findMany();
    return {
      accounts
    };
  }
};

// src/use-cases/factories/make-get-accounts-use-case.ts
function MakeGetAccountsUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const getAccountUseCase = new GetAccountsUseCase(accountsRepository);
  return getAccountUseCase;
}

// src/http/controllers/financial/getAccount.ts
async function getAccount(request, reply) {
  let accounts;
  try {
    const getAccountUseCase = MakeGetAccountsUseCase();
    accounts = await getAccountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(accounts);
}

// src/http/controllers/financial/transaction.ts
var import_zod4 = require("zod");

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
    const createTransaction2 = {
      ...data,
      account_id: void 0,
      sector_id: void 0
    };
    const client = tx ?? prisma;
    let transaction;
    if (!data.sector_id) {
      transaction = await client.transaction.create({
        data: {
          ...createTransaction2,
          accounts: {
            connect: { id: data.account_id }
          }
        }
      });
    } else {
      transaction = await client.transaction.create({
        data: {
          ...createTransaction2,
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

// src/use-cases/transaction.ts
var TransactionUseCase = class {
  constructor(transactionsRepository, transferTransactionsRepository, accountsRepository) {
    this.transactionsRepository = transactionsRepository;
    this.transferTransactionsRepository = transferTransactionsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    operation,
    amount,
    account_id,
    date,
    sector_id,
    description,
    confirmed,
    destination_account_id
  }) {
    if (operation !== "income" && operation !== "expense" && operation !== "transfer") {
      throw new ResourceNotFoundError();
    }
    let account;
    if (account_id)
      account = await this.accountsRepository.findById(account_id);
    if (!account)
      throw new ResourceNotFoundError();
    const isIncome = operation === "income" ? true : false;
    if (confirmed === true || operation === "transfer") {
      await this.accountsRepository.changeBalance(account_id, amount, isIncome);
    }
    const transaction = await this.transactionsRepository.create({
      operation,
      amount,
      account_id,
      date: date ? date : /* @__PURE__ */ new Date(),
      sector_id,
      description,
      confirmed: operation === "transfer" ? true : confirmed ? confirmed : false
    });
    if (operation === "transfer" && destination_account_id) {
      await this.transferTransactionsRepository.create({
        destination_account_id,
        transaction_id: transaction.id
      });
      console.log("change balance");
      await this.accountsRepository.changeBalance(destination_account_id, amount, !isIncome);
    }
    return {
      transaction
    };
  }
};

// src/repositories/prisma/prisma-transfer-transactions-repository.ts
var PrismaTransferTransactionsRepository = class {
  async findByAccount(account_id) {
    const transferTransaction = prisma.transferTransaction.findMany({
      where: {
        destination_account_id: account_id
      }
    });
    return transferTransaction;
  }
  async create(data) {
    const transaction = prisma.transferTransaction.create({
      data
    });
    return transaction;
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
          date: "desc"
        }
      }
    });
    return transferTransactions;
  }
};

// src/use-cases/factories/make-transaction-use-case.ts
function MakeTransactionUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const transferTransactionsRepository = new PrismaTransferTransactionsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const useCase = new TransactionUseCase(transactionsRepository, transferTransactionsRepository, accountsRepository);
  return useCase;
}

// src/http/controllers/financial/transaction.ts
async function createTransaction(request, reply) {
  const registerBodySchema = import_zod4.z.object({
    operation: import_zod4.z.string(),
    amount: import_zod4.z.number(),
    account_id: import_zod4.z.string(),
    date: import_zod4.z.coerce.date().nullish(),
    sector_id: import_zod4.z.string().nullish(),
    description: import_zod4.z.string().nullish(),
    confirmed: import_zod4.z.boolean().nullish(),
    destination_account_id: import_zod4.z.string().nullish()
  });
  console.log(request.body);
  const { operation, amount, account_id, date, sector_id, description, confirmed, destination_account_id } = registerBodySchema.parse(request.body);
  console.log("aqui");
  let transaction;
  try {
    const transactionUseCase = MakeTransactionUseCase();
    transaction = await transactionUseCase.execute({
      operation,
      amount,
      account_id,
      confirmed: confirmed || null,
      date: date || null,
      sector_id: sector_id || null,
      description: description || null,
      destination_account_id: destination_account_id || null
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(transaction);
}

// src/use-cases/get-transactions.ts
var GetTransactionsUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute({ pageIndex, perPage, description, value, sector_id, account_id, month, status, toDate }) {
    console.log("USE CASE ACCOUNT" + account_id);
    if (!perPage)
      perPage = 6;
    const transactions = await this.transactionsRepository.findMany(month, pageIndex, perPage, description, value, sector_id, account_id, status, toDate);
    return transactions;
  }
};

// src/use-cases/factories/make-get-transactions-use-case.ts
function MakeGetTransactionsUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getTransactionUseCase = new GetTransactionsUseCase(transactionsRepository);
  return getTransactionUseCase;
}

// src/http/controllers/financial/getTransactions.ts
var import_zod5 = require("zod");
async function getTransactions(request, reply) {
  const getTransactionsParamsSchema = import_zod5.z.object({
    page: import_zod5.z.string(),
    description: import_zod5.z.string().nullish(),
    value: import_zod5.z.string().nullish(),
    sector_id: import_zod5.z.string().nullish(),
    account_id: import_zod5.z.string().nullish(),
    month: import_zod5.z.date().nullish(),
    status: import_zod5.z.string().nullish(),
    toDate: import_zod5.z.string().nullish()
  });
  const { page, description, value, sector_id, account_id, month, status, toDate } = getTransactionsParamsSchema.parse(request.query);
  let transactions;
  console.log("Descri\xE7\xE3o: " + description);
  console.log("Valor: " + value);
  console.log("Setor: " + sector_id);
  console.log("Account*************: " + account_id);
  try {
    const getTransactionUseCase = MakeGetTransactionsUseCase();
    transactions = await getTransactionUseCase.execute({
      pageIndex: parseInt(page),
      description: description ? description : void 0,
      value: value ? Number(value) : void 0,
      month: month ? month : /* @__PURE__ */ new Date(),
      sector_id: sector_id ? sector_id : "all",
      account_id: account_id ? account_id : "all",
      status: status || void 0,
      toDate: toDate ? new Date(toDate) : void 0
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send({ transactions });
}

// src/use-cases/get-transfer-transactions.ts
var GetTransferTransactionsUseCase = class {
  constructor(transferTransactionsRepository) {
    this.transferTransactionsRepository = transferTransactionsRepository;
  }
  async execute() {
    const transferTransactions = await this.transferTransactionsRepository.findMany();
    return { transferTransactions };
  }
};

// src/use-cases/factories/make-get-transfer-transactions-use-case.ts
function MakeGetTransferTransactionsUseCase() {
  const transferTransactionsRepository = new PrismaTransferTransactionsRepository();
  const getTransferTransactionUseCase = new GetTransferTransactionsUseCase(transferTransactionsRepository);
  return getTransferTransactionUseCase;
}

// src/http/controllers/financial/getTransferTransaction.ts
async function getTransferTransaction(request, reply) {
  let transactions;
  try {
    const getTransferTransactionUseCase = MakeGetTransferTransactionsUseCase();
    transactions = await getTransferTransactionUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(transactions);
}

// src/repositories/prisma/prisma-payments-repository.ts
var PrismaPaymentsRepository = class {
  async create(data) {
    const payment = await prisma.payment.create({
      data
    });
    return payment;
  }
  async update(id, data) {
    const payment = await prisma.payment.update({
      where: { id },
      data
    });
    return payment;
  }
  async delete(id) {
    await prisma.payment.delete({
      where: { id }
    });
  }
  async findById(id) {
    const payment = await prisma.payment.findFirst({
      where: {
        id
      }
    });
    return payment;
  }
  async findMany() {
    const payments = await prisma.payment.findMany({
      include: {
        accounts: true
      }
    });
    return payments;
  }
  async findByName(name) {
    const payments = await prisma.payment.findFirst({ where: { name } });
    return payments;
  }
};

// src/use-cases/payment.ts
var PaymentUseCase = class {
  constructor(paymentsRepository, accountsRepository) {
    this.paymentsRepository = paymentsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    name,
    installment_limit,
    in_sight,
    account_id
  }) {
    const sameNamePayment = await this.paymentsRepository.findByName(name);
    if (sameNamePayment)
      throw new ThisNameAlreadyExistsError();
    if (installment_limit <= 0)
      throw new OnlyNaturalNumbersError();
    let findedAccount;
    if (account_id)
      findedAccount = await this.accountsRepository.findById(account_id);
    if (!findedAccount)
      throw new ResourceNotFoundError();
    const payment = await this.paymentsRepository.create({
      name,
      installment_limit,
      in_sight,
      account_id
    });
    return {
      payment
    };
  }
};

// src/use-cases/factories/make-payment-use-case.ts
function MakePaymentUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const paymentUseCase = new PaymentUseCase(paymentsRepository, accountsRepository);
  return paymentUseCase;
}

// src/http/controllers/financial/payment.ts
var import_zod6 = require("zod");
async function createPayment(request, reply) {
  const registerBodySchema = import_zod6.z.object({
    name: import_zod6.z.string(),
    installment_limit: import_zod6.z.number(),
    in_sight: import_zod6.z.boolean(),
    account_id: import_zod6.z.string()
  });
  const { name, installment_limit, in_sight, account_id } = registerBodySchema.parse(request.body);
  let payment;
  try {
    const paymentUseCase = MakePaymentUseCase();
    payment = await paymentUseCase.execute({
      name,
      installment_limit,
      in_sight,
      account_id
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(payment);
}

// src/repositories/prisma/prisma-payment-entrys-repository.ts
var PrismaPaymentEntrysRepository = class {
  update(data) {
    throw new Error("Method not implemented.");
  }
  async findById(id) {
    const paymentEntry = await prisma.paymentEntry.findUnique({ where: { id } });
    return paymentEntry;
  }
  async findMany() {
    const paymentEntry = prisma.paymentEntry.findMany();
    return paymentEntry;
  }
  async findByTreatmentId(treatment_id) {
    const paymentEntries = await prisma.paymentEntry.findMany({
      where: {
        treatment_id
      },
      include: {
        payments: true
      }
    });
    return paymentEntries;
  }
  async create(data) {
    const paymentEntry = await prisma.paymentEntry.create({
      data
    });
    return paymentEntry;
  }
};

// src/use-cases/paymentEntry.ts
var PaymentEntryUseCase = class {
  constructor(paymentEntrysRepository, paymentRepository, treatmentRepository) {
    this.paymentEntrysRepository = paymentEntrysRepository;
    this.paymentRepository = paymentRepository;
    this.treatmentRepository = treatmentRepository;
  }
  async execute({
    payment_id,
    treatment_id,
    occurrences,
    amount
  }) {
    const payment = await this.paymentRepository.findById(payment_id);
    if (!payment)
      throw new ResourceNotFoundError();
    const treatment = await this.treatmentRepository.findById(treatment_id);
    if (!treatment)
      throw new ResourceNotFoundError();
    if (occurrences <= 0 || amount <= 0)
      throw new OnlyNaturalNumbersError();
    const paymentEntry = await this.paymentEntrysRepository.create({
      payment_id,
      treatment_id,
      occurrences,
      amount
    });
    return {
      paymentEntry
    };
  }
};

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

// src/use-cases/factories/make-payment-entry-use-case.ts
function MakePaymentEntryUseCase() {
  const paymentEntrysRepository = new PrismaPaymentEntrysRepository();
  const paymentsRepository = new PrismaPaymentsRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const paymentEntryUseCase = new PaymentEntryUseCase(paymentEntrysRepository, paymentsRepository, treatmentsRepository);
  return paymentEntryUseCase;
}

// src/http/controllers/financial/paymentEntry.ts
var import_zod7 = require("zod");
async function createPaymentEntry(request, reply) {
  const registerBodySchema = import_zod7.z.object({
    treatment_id: import_zod7.z.string(),
    payment_id: import_zod7.z.string(),
    amount: import_zod7.z.number(),
    occurrences: import_zod7.z.number()
  });
  const { treatment_id, payment_id, amount, occurrences } = registerBodySchema.parse(request.body);
  let paymentEntry;
  try {
    const paymentEntryUseCase = MakePaymentEntryUseCase();
    paymentEntry = await paymentEntryUseCase.execute({
      treatment_id,
      payment_id,
      amount,
      occurrences
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(paymentEntry);
}

// src/http/middlewares/verify-user-role.ts
function verifyUserRole(roleToVerify) {
  return async (request, reply) => {
    const { role } = request.user;
    if (role !== roleToVerify) {
      return reply.status(401).send({ message: "Usu\xE1rio esta desautorizado para esta fun\xE7\xE3o" });
    }
  };
}

// src/use-cases/errors/transaction-already-confirmed-error.ts
var TransactionAlreadyConfirmedError = class extends Error {
  constructor() {
    super("Transaction is already confirmed and cannot be changed.");
    this.name = "TransactionAlreadyConfirmedError";
  }
};

// src/use-cases/change-transaction-status.ts
function getCleanRemainingDescription(originalTransaction) {
  const originalDescription = originalTransaction.description || "";
  let baseDescription = originalDescription.trim();
  let currentLevel = 0;
  const numberedPrefixRegex = /^PR\s*\((\d+)\):/i;
  const numberedMatch = baseDescription.match(numberedPrefixRegex);
  if (numberedMatch) {
    currentLevel = parseInt(numberedMatch[1], 10);
    baseDescription = baseDescription.substring(numberedMatch[0].length).trim();
  } else {
    const genericPrefixes = [
      "PR: ",
      "RES: ",
      "PARCELA RESTANTE: "
    ];
    for (const prefix of genericPrefixes) {
      if (baseDescription.startsWith(prefix)) {
        currentLevel = 1;
        baseDescription = baseDescription.substring(prefix.length).trim();
        break;
      }
    }
  }
  const newLevel = currentLevel + 1;
  if (baseDescription === "") {
    baseDescription = "Sem Descri\xE7\xE3o Original";
  }
  return `PR (${newLevel}): ${baseDescription}`;
}
var ChangeTransactionUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute({
    id,
    amount: amountPaid,
    date,
    remainingDate,
    account_id
    // Recebe a conta
  }) {
    const originalTransaction = await this.transactionsRepository.findById(id);
    if (!originalTransaction) {
      throw new ResourceNotFoundError();
    }
    if (originalTransaction.confirmed) {
      throw new TransactionAlreadyConfirmedError();
    }
    if (amountPaid <= 0) {
      throw new Error("O valor de liquida\xE7\xE3o (amount) deve ser positivo.");
    }
    if (amountPaid > originalTransaction.amount) {
      throw new Error(`O valor pago (${amountPaid}) n\xE3o pode ser maior que o valor da transa\xE7\xE3o original (${originalTransaction.amount}).`);
    }
    const remainingAmount = originalTransaction.amount - amountPaid;
    if (remainingAmount > 0) {
      const newDueDate = remainingDate || originalTransaction.date;
      const newDescription = getCleanRemainingDescription(originalTransaction);
      const remainingTransactionData = {
        operation: originalTransaction.operation,
        account_id: originalTransaction.account_id,
        // Mantém na conta original
        sector_id: originalTransaction.sector_id,
        amount: remainingAmount,
        confirmed: false,
        date: newDueDate,
        description: newDescription
        // <-- DESCRIÇÃO NUMERADA
      };
      await this.transactionsRepository.create(remainingTransactionData);
    }
    await this.transactionsRepository.changeTransactionStatus({
      id,
      amount: amountPaid,
      date,
      account_id
      // Passa a nova conta para a repository atualizar antes de confirmar
    });
  }
};

// src/use-cases/factories/make-change-transaction-status.ts
function MakeChangeTransactionStatusUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const changeTransactionUseCase = new ChangeTransactionUseCase(
    transactionsRepository
  );
  return changeTransactionUseCase;
}

// src/http/controllers/financial/changeTransactionPayment.ts
var import_zod8 = require("zod");
async function changeTransactionStatus(request, reply) {
  const switchTransactionParamsSchema = import_zod8.z.object({
    id: import_zod8.z.string().uuid()
  });
  const switchTransactionBodySchema = import_zod8.z.object({
    amount: import_zod8.z.number().positive(),
    date: import_zod8.z.string().or(import_zod8.z.date()).transform((val) => new Date(val)),
    // Data de liquidação
    // NOVO: remainingDate é opcional e deve ser uma data
    remainingDate: import_zod8.z.string().or(import_zod8.z.date()).transform((val) => new Date(val)).optional(),
    // NOVO: Permitir trocar a conta na hora do pagamento
    account_id: import_zod8.z.string().uuid().optional()
  });
  const { id } = switchTransactionParamsSchema.parse(request.params);
  const { amount, date, remainingDate, account_id } = switchTransactionBodySchema.parse(
    request.body
  );
  console.log({ amount, date, remainingDate, account_id });
  try {
    const changeTransactionStatusUseCase = MakeChangeTransactionStatusUseCase();
    await changeTransactionStatusUseCase.execute({
      id,
      amount,
      // Valor pago (parcial ou total)
      date,
      // Data de confirmação/pagamento
      remainingDate,
      // Passa a nova data de vencimento da parcela restante (opcional)
      account_id
      // Conta selecionada (opcional)
    });
    return reply.status(200).send();
  } catch (err) {
    if (err instanceof import_zod8.z.ZodError) {
      return reply.status(400).send({ message: "Validation error.", issues: err.format() });
    }
    if (err instanceof Error) {
      if (err.message.includes("Resource not found")) {
        return reply.status(404).send({ message: "Transaction not found." });
      }
      return reply.status(400).send({ message: err.message });
    }
    console.error(err);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

// src/use-cases/delete-transaction.ts
var DeleteTransactionUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute({
    id
  }) {
    const transaction = await this.transactionsRepository.findById(id);
    if (!transaction) {
      throw new ResourceNotFoundError();
    }
    if (transaction.confirmed) {
      throw new TransactionAlreadyConfirmedError();
    }
    await this.transactionsRepository.delete(id);
  }
};

// src/use-cases/factories/make-delete-transaction.ts
function MakeDeleteTransactionUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const treatmentItemUseCase = new DeleteTransactionUseCase(
    transactionsRepository
  );
  return treatmentItemUseCase;
}

// src/http/controllers/financial/deleteTransaction.ts
var import_zod9 = require("zod");
async function deleteTransaction(request, reply) {
  const deleteItemTreatmentParamsSchema = import_zod9.z.object({
    id: import_zod9.z.string().uuid()
  });
  const { id } = deleteItemTreatmentParamsSchema.parse(request.params);
  console.log(id);
  try {
    const deleteTransactionUseCase = MakeDeleteTransactionUseCase();
    await deleteTransactionUseCase.execute({
      id
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/use-cases/get-payments.ts
var GetPaymentsUseCase = class {
  constructor(paymentsRepository) {
    this.paymentsRepository = paymentsRepository;
  }
  async execute() {
    const payments = await this.paymentsRepository.findMany();
    return payments;
  }
};

// src/use-cases/factories/make-get-payments-use-case.ts
function MakeGetPaymentsUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const getPaymentsUseCase = new GetPaymentsUseCase(paymentsRepository);
  return getPaymentsUseCase;
}

// src/http/controllers/financial/getPayments.ts
async function getPayments(request, reply) {
  let payments;
  try {
    const getPaymentsUseCase = MakeGetPaymentsUseCase();
    payments = await getPaymentsUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(payments);
}

// src/use-cases/get-financial-summary.ts
var GetFinancialSummaryUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const summary = await this.transactionsRepository.getFinancialSummary();
    return { summary };
  }
};

// src/use-cases/factories/make-get-financial-summary.ts
function MakeGetFinancialSummaryUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getFinancialSummaryUseCase = new GetFinancialSummaryUseCase(transactionsRepository);
  return getFinancialSummaryUseCase;
}

// src/http/controllers/financial/get-financial-summary.ts
async function getFinancialSummary(request, reply) {
  let financialSummary;
  try {
    const getFinancialSummaryUseCase = MakeGetFinancialSummaryUseCase();
    financialSummary = await getFinancialSummaryUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(financialSummary);
}

// src/http/controllers/financial/updateAccount.ts
var import_zod10 = require("zod");

// src/use-cases/update-account.ts
var UpdateAccountUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({
    id,
    name,
    description,
    goal
  }) {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundError();
    }
    const updatedAccount = await this.accountsRepository.update(id, {
      name,
      description,
      goal
      // Balance is NOT updated here to ensure integrity
    });
    if (!updatedAccount) {
      throw new ResourceNotFoundError();
    }
    return {
      account: updatedAccount
    };
  }
};

// src/use-cases/factories/make-update-account-use-case.ts
function MakeUpdateAccountUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const updateAccountUseCase = new UpdateAccountUseCase(accountsRepository);
  return updateAccountUseCase;
}

// src/http/controllers/financial/updateAccount.ts
async function updateAccount(request, reply) {
  const updateAccountParamsSchema = import_zod10.z.object({
    id: import_zod10.z.string().uuid()
  });
  const updateAccountBodySchema = import_zod10.z.object({
    name: import_zod10.z.string().optional(),
    description: import_zod10.z.string().nullable().optional(),
    goal: import_zod10.z.number().nullable().optional()
  });
  const { id } = updateAccountParamsSchema.parse(request.params);
  const { name, description, goal } = updateAccountBodySchema.parse(request.body);
  try {
    const updateAccountUseCase = MakeUpdateAccountUseCase();
    await updateAccountUseCase.execute({
      id,
      name,
      description,
      goal
    });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/financial/deleteAccount.ts
var import_zod11 = require("zod");

// src/use-cases/delete-account.ts
var DeleteAccountUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({ id }) {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundError();
    }
    await this.accountsRepository.delete(id);
  }
};

// src/use-cases/factories/make-delete-account-use-case.ts
function MakeDeleteAccountUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const deleteAccountUseCase = new DeleteAccountUseCase(accountsRepository);
  return deleteAccountUseCase;
}

// src/http/controllers/financial/deleteAccount.ts
async function deleteAccount(request, reply) {
  const deleteAccountParamsSchema = import_zod11.z.object({
    id: import_zod11.z.string().uuid()
  });
  const { id } = deleteAccountParamsSchema.parse(request.params);
  try {
    const deleteAccountUseCase = MakeDeleteAccountUseCase();
    await deleteAccountUseCase.execute({ id });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/http/controllers/financial/updatePayment.ts
var import_zod12 = require("zod");

// src/use-cases/update-payment.ts
var UpdatePaymentUseCase = class {
  constructor(paymentsRepository, accountsRepository) {
    this.paymentsRepository = paymentsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    id,
    name,
    installment_limit,
    in_sight,
    account_id
  }) {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new ResourceNotFoundError();
    }
    if (account_id) {
      const account = await this.accountsRepository.findById(account_id);
      if (!account) {
        throw new ResourceNotFoundError();
      }
    }
    const updatedPayment = await this.paymentsRepository.update(id, {
      name,
      installment_limit,
      in_sight,
      account_id
    });
    return {
      payment: updatedPayment
    };
  }
};

// src/use-cases/factories/make-update-payment-use-case.ts
function MakeUpdatePaymentUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const updatePaymentUseCase = new UpdatePaymentUseCase(paymentsRepository, accountsRepository);
  return updatePaymentUseCase;
}

// src/http/controllers/financial/updatePayment.ts
async function updatePayment(request, reply) {
  const updatePaymentParamsSchema = import_zod12.z.object({
    id: import_zod12.z.string().uuid()
  });
  const updatePaymentBodySchema = import_zod12.z.object({
    name: import_zod12.z.string().optional(),
    installment_limit: import_zod12.z.number().optional(),
    in_sight: import_zod12.z.boolean().optional(),
    account_id: import_zod12.z.string().uuid().optional()
  });
  const { id } = updatePaymentParamsSchema.parse(request.params);
  const { name, installment_limit, in_sight, account_id } = updatePaymentBodySchema.parse(request.body);
  try {
    const updatePaymentUseCase = MakeUpdatePaymentUseCase();
    await updatePaymentUseCase.execute({
      id,
      name,
      installment_limit,
      in_sight,
      account_id
    });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/financial/deletePayment.ts
var import_zod13 = require("zod");

// src/use-cases/delete-payment.ts
var DeletePaymentUseCase = class {
  constructor(paymentsRepository) {
    this.paymentsRepository = paymentsRepository;
  }
  async execute({ id }) {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new ResourceNotFoundError();
    }
    await this.paymentsRepository.delete(id);
  }
};

// src/use-cases/factories/make-delete-payment-use-case.ts
function MakeDeletePaymentUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const deletePaymentUseCase = new DeletePaymentUseCase(paymentsRepository);
  return deletePaymentUseCase;
}

// src/http/controllers/financial/deletePayment.ts
async function deletePayment(request, reply) {
  const deletePaymentParamsSchema = import_zod13.z.object({
    id: import_zod13.z.string().uuid()
  });
  const { id } = deletePaymentParamsSchema.parse(request.params);
  try {
    const deletePaymentUseCase = MakeDeletePaymentUseCase();
    await deletePaymentUseCase.execute({ id });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/http/controllers/financial/adjustAccountBalance.ts
var import_zod14 = require("zod");

// src/use-cases/adjust-account-balance.ts
var AdjustAccountBalanceUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({
    id,
    newBalance
  }) {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id }
      });
      if (!account) {
        throw new ResourceNotFoundError();
      }
      const currentBalance = account.balance;
      const diff = newBalance - currentBalance;
      if (diff === 0) {
        return { account };
      }
      const amount = Math.abs(diff);
      const operation = diff > 0 ? "IN" : "OUT";
      await tx.transaction.create({
        data: {
          account_id: id,
          amount,
          operation,
          description: "Ajuste de Saldo Manual",
          confirmed: true,
          date: /* @__PURE__ */ new Date()
        }
      });
      const updatedAccount = await tx.account.update({
        where: { id },
        data: {
          balance: newBalance
        }
      });
      return { account: updatedAccount };
    });
  }
};

// src/use-cases/factories/make-adjust-account-balance-use-case.ts
function makeAdjustAccountBalanceUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const useCase = new AdjustAccountBalanceUseCase(accountsRepository);
  return useCase;
}

// src/http/controllers/financial/adjustAccountBalance.ts
async function adjustAccountBalance(request, reply) {
  const adjustAccountBalanceBodySchema = import_zod14.z.object({
    newBalance: import_zod14.z.number()
  });
  const adjustAccountBalanceParamsSchema = import_zod14.z.object({
    id: import_zod14.z.string().uuid()
  });
  const { newBalance } = adjustAccountBalanceBodySchema.parse(request.body);
  const { id } = adjustAccountBalanceParamsSchema.parse(request.params);
  try {
    const adjustAccountBalanceUseCase = makeAdjustAccountBalanceUseCase();
    await adjustAccountBalanceUseCase.execute({
      id,
      newBalance
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/financial/routes.ts
async function financialRoutes(app) {
  app.addHook("onRequest", verifyJWT);
  app.post("/sector", { onRequest: [verifyUserRole("ADMIN")] }, createSector);
  app.get("/sectors", getSector);
  app.post("/account", createAccount);
  app.get("/accounts", getAccount);
  app.patch("/account/:id/adjust-balance", adjustAccountBalance);
  app.put("/account/:id", updateAccount);
  app.delete("/account/:id", deleteAccount);
  app.post("/transaction", createTransaction);
  app.get("/transactions", getTransactions);
  app.delete("/transaction/:id", deleteTransaction);
  app.get("/transfer-transactions", getTransferTransaction);
  app.post("/payment", createPayment);
  app.post("/payment-entry", createPaymentEntry);
  app.patch("/switch-transaction/:id", changeTransactionStatus);
  app.get("/payments", getPayments);
  app.put("/payment/:id", updatePayment);
  app.delete("/payment/:id", deletePayment);
  app.get("/summary", getFinancialSummary);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  financialRoutes
});
