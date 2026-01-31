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

// src/use-cases/adjust-account-balance.ts
var adjust_account_balance_exports = {};
__export(adjust_account_balance_exports, {
  AdjustAccountBalanceUseCase: () => AdjustAccountBalanceUseCase
});
module.exports = __toCommonJS(adjust_account_balance_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AdjustAccountBalanceUseCase
});
