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

// src/use-cases/factories/make-get-transfer-transactions-use-case.ts
var make_get_transfer_transactions_use_case_exports = {};
__export(make_get_transfer_transactions_use_case_exports, {
  MakeGetTransferTransactionsUseCase: () => MakeGetTransferTransactionsUseCase
});
module.exports = __toCommonJS(make_get_transfer_transactions_use_case_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakeGetTransferTransactionsUseCase
});
