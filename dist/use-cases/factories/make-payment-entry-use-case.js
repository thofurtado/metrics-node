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

// src/use-cases/factories/make-payment-entry-use-case.ts
var make_payment_entry_use_case_exports = {};
__export(make_payment_entry_use_case_exports, {
  MakePaymentEntryUseCase: () => MakePaymentEntryUseCase
});
module.exports = __toCommonJS(make_payment_entry_use_case_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakePaymentEntryUseCase
});
