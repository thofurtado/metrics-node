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

// src/use-cases/factories/make-payment-use-case.ts
var make_payment_use_case_exports = {};
__export(make_payment_use_case_exports, {
  MakePaymentUseCase: () => MakePaymentUseCase
});
module.exports = __toCommonJS(make_payment_use_case_exports);

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

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
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

// src/use-cases/factories/make-payment-use-case.ts
function MakePaymentUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const paymentUseCase = new PaymentUseCase(paymentsRepository, accountsRepository);
  return paymentUseCase;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakePaymentUseCase
});
