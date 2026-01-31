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

// src/use-cases/factories/make-get-balance-projection-use-case.ts
var make_get_balance_projection_use_case_exports = {};
__export(make_get_balance_projection_use_case_exports, {
  MakeGetBalanceProjectionUseCase: () => MakeGetBalanceProjectionUseCase
});
module.exports = __toCommonJS(make_get_balance_projection_use_case_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakeGetBalanceProjectionUseCase
});
