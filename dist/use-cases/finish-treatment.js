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

// src/use-cases/finish-treatment.ts
var finish_treatment_exports = {};
__export(finish_treatment_exports, {
  FinishTreatmentUseCase: () => FinishTreatmentUseCase
});
module.exports = __toCommonJS(finish_treatment_exports);

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

// src/use-cases/finish-treatment.ts
var FinishTreatmentUseCase = class {
  constructor(treatmentsRepository, paymentEntrysRepository, itemsRepository, transactionsRepository, accountsRepository) {
    this.treatmentsRepository = treatmentsRepository;
    this.paymentEntrysRepository = paymentEntrysRepository;
    this.itemsRepository = itemsRepository;
    this.transactionsRepository = transactionsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    treatment_id
  }) {
    const treatment = await this.treatmentsRepository.findById(treatment_id);
    if (!treatment) {
      throw new ResourceNotFoundError();
    }
    if (treatment.status === "resolved" || treatment.status === "finished") {
      throw new Error("Treatment already finished");
    }
    const calculatedTotal = treatment.amount;
    const paymentEntries = await this.paymentEntrysRepository.findByTreatmentId(treatment_id);
    const totalPaid = paymentEntries?.reduce((acc, entry) => acc + Number(entry.amount) * entry.occurrences, 0) || 0;
    if (totalPaid < treatment.amount - 0.05) {
      throw new Error(`Pagamento insuficiente. Total a pagar: ${treatment.amount.toFixed(2)}, Pago: ${totalPaid.toFixed(2)}`);
    }
    return await prisma.$transaction(async (tx) => {
      if (treatment.items) {
        for (const tItem of treatment.items) {
          const itemData = tItem.items;
          if (itemData && itemData.isItem) {
            await this.itemsRepository.changeStock(tItem.item_id, tItem.quantity, false, tx);
            await tx.stock.create({
              data: {
                item_id: tItem.item_id,
                quantity: tItem.quantity,
                // @ts-ignore
                operation: "OUT",
                // @ts-ignore
                description: "VENDA",
                created_at: /* @__PURE__ */ new Date()
              }
            });
          }
        }
      }
      if (paymentEntries) {
        for (const entry of paymentEntries) {
          const paymentMethod = entry.payments;
          if (!paymentMethod) continue;
          const accountId = paymentMethod.account_id;
          if (!accountId) {
            console.warn(`Payment method ${paymentMethod.name} has no account linked. Skipping transaction creation.`);
            continue;
          }
          for (let i = 0; i < entry.occurrences; i++) {
            const dueDate = /* @__PURE__ */ new Date();
            dueDate.setMonth(dueDate.getMonth() + i);
            let isConfirmed = false;
            if (paymentMethod.in_sight) {
              isConfirmed = true;
            }
            const transaction = await this.transactionsRepository.create({
              amount: entry.amount,
              operation: "income",
              date: dueDate,
              account_id: accountId,
              description: `Atendimento #${treatment.id} - ${paymentMethod.name} (${i + 1}/${entry.occurrences})`,
              confirmed: isConfirmed
            }, tx);
            if (isConfirmed) {
              await this.accountsRepository.changeBalance(accountId, entry.amount, true, tx);
            }
          }
        }
      }
      const closedTreatment = await this.treatmentsRepository.close(treatment_id, tx);
      if (!closedTreatment) throw new ResourceNotFoundError();
      return { treatment: closedTreatment };
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FinishTreatmentUseCase
});
