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

// src/use-cases/factories/make-account-use-case.ts
var make_account_use_case_exports = {};
__export(make_account_use_case_exports, {
  MakeAccountUseCase: () => MakeAccountUseCase
});
module.exports = __toCommonJS(make_account_use_case_exports);

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

// src/use-cases/errors/this-name-already-exists-error.ts
var ThisNameAlreadyExistsError = class extends Error {
  constructor() {
    super("Nome j\xE1 cadastrado");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakeAccountUseCase
});
