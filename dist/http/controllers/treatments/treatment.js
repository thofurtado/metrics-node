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

// src/http/controllers/treatments/treatment.ts
var treatment_exports = {};
__export(treatment_exports, {
  createTreatment: () => createTreatment
});
module.exports = __toCommonJS(treatment_exports);

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

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/treatment.ts
var TreatmentUseCase = class {
  constructor(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository) {
    this.treatmentsRepository = treatmentsRepository;
    this.clientsRepository = clientsRepository;
    this.equipmentsRepository = equipmentsRepository;
    this.usersRepository = usersRepository;
  }
  async execute({
    opening_date,
    contact,
    client_id,
    equipment_id,
    user_id,
    request,
    status,
    amount,
    observations,
    ending_date
  }) {
    let user;
    if (user_id) {
      user = await this.usersRepository.findById(user_id);
      if (!user)
        throw new ResourceNotFoundError();
    }
    let client;
    if (client_id) {
      client = await this.clientsRepository.findById(client_id);
      if (!client)
        throw new ResourceNotFoundError();
    }
    let equipment;
    if (equipment_id) {
      equipment = await this.equipmentsRepository.findById(equipment_id);
      if (!equipment)
        throw new ResourceNotFoundError();
    }
    const treatment = await this.treatmentsRepository.create({
      opening_date,
      contact,
      client_id,
      equipment_id,
      request,
      status,
      amount,
      observations,
      ending_date
    });
    return {
      treatment
    };
  }
};

// src/repositories/prisma/prisma-clients-repository.ts
var PrismaClientsRepository = class {
  async findByName(name) {
    throw new Error("Method not implemented.");
  }
  async findMany(is_contract) {
    const clients = await prisma.client.findMany({
      include: {
        equipments: true,
        addresses: true
      },
      orderBy: [
        {
          name: "asc"
        }
      ]
    });
    return clients;
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    throw new Error("Method not implemented.");
  }
  async findById(id) {
    const client = await prisma.client.findUnique({
      where: {
        id
      }
    });
    return client;
  }
  async create(data) {
    const client = await prisma.client.create({
      data
    });
    return client;
  }
};

// src/repositories/prisma/prisma-equipments-repository.ts
var PrismaEquipmentsRepository = class {
  async findById(id) {
    const equipment = await prisma.equipment.findUnique({
      where: { id }
    });
    return equipment;
  }
  async findByClientId(client_id) {
    const equipment = await prisma.equipment.findMany({
      where: { client_id }
    });
    return equipment;
  }
  async create(data) {
    const equipment = await prisma.equipment.create({
      data
    });
    return equipment;
  }
  findByClient(client_id) {
    const equiepments = prisma.equipment.findMany({
      where: {
        client_id
      }
    });
    return equiepments;
  }
  findMany(type, brand, identification) {
    const equiepments = prisma.equipment.findMany({
      where: {
        type,
        brand,
        identification
      }
    });
    return equiepments;
  }
};

// src/repositories/prisma/prisma-users-repository.ts
var PrismaUsersRepository = class {
  async update(id, data) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        introduction: data.introduction,
        password_hash: data.password_hash
      }
    });
    return user;
  }
  async findById(id) {
    const user = await prisma.user.findUnique({
      where: {
        id
      }
    });
    return user;
  }
  async findByEmail(email) {
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });
    return user;
  }
  async create(data) {
    const user = await prisma.user.create({
      data
    });
    return user;
  }
};

// src/use-cases/factories/make-treatment-use-case.ts
function MakeTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const clientsRepository = new PrismaClientsRepository();
  const equipmentsRepository = new PrismaEquipmentsRepository();
  const usersRepository = new PrismaUsersRepository();
  const treatmentUseCase = new TreatmentUseCase(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository);
  return treatmentUseCase;
}

// src/http/controllers/treatments/treatment.ts
var import_zod2 = require("zod");
async function createTreatment(request, reply) {
  const registerBodySchema = import_zod2.z.object({
    opening_date: import_zod2.z.coerce.date().nullish(),
    ending_date: import_zod2.z.coerce.date().nullish(),
    contact: import_zod2.z.string().nullish(),
    user_id: import_zod2.z.string().nullish(),
    client_id: import_zod2.z.string().nullish(),
    equipment_id: import_zod2.z.string().nullish(),
    request: import_zod2.z.string(),
    status: import_zod2.z.string().nullish(),
    amount: import_zod2.z.number().nullish(),
    observations: import_zod2.z.string().nullish()
  });
  const { opening_date, ending_date, contact, user_id, client_id, equipment_id, status, amount, observations } = registerBodySchema.parse(request.body);
  const test = registerBodySchema.parse(request.body);
  let treatment;
  try {
    const treatmentUseCase = MakeTreatmentUseCase();
    treatment = await treatmentUseCase.execute({
      opening_date: opening_date ? opening_date : /* @__PURE__ */ new Date(),
      ending_date: status === "resolved" ? /* @__PURE__ */ new Date() : void 0,
      contact: contact ? contact : void 0,
      user_id: user_id ? user_id : void 0,
      client_id: client_id ? client_id : void 0,
      equipment_id: equipment_id ? equipment_id : void 0,
      request: test.request,
      status: status ? status : "pending",
      amount: amount ? amount : 0,
      observations: observations ? observations : void 0
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(treatment);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createTreatment
});
