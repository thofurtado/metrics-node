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

// src/http/controllers/treatments/routes.ts
var routes_exports = {};
__export(routes_exports, {
  treatmentsRoutes: () => treatmentsRoutes
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

// src/repositories/prisma/prisma-treatment-items-repository.ts
var PrismaTreatmentItemsRepository = class {
  async findById(id) {
    const treatmentItem = await prisma.treatmentItem.findFirst({ where: { id } });
    return treatmentItem;
  }
  async remove(id) {
    await prisma.treatmentItem.delete({
      where: { id }
    });
  }
  async findByTreatment(treatment_id) {
    const treatmentItems = prisma.treatmentItem.findMany({
      where: {
        treatment_id
      }
    });
    return treatmentItems;
  }
  async linkStock(id, stock_id) {
    await prisma.treatmentItem.update({
      where: { id },
      data: { stock_id }
    });
  }
  update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    await prisma.treatmentItem.delete({
      where: {
        id
      }
    });
  }
  async create(data) {
    const treatmentItem = prisma.treatmentItem.create({
      data
    });
    return treatmentItem;
  }
};

// src/use-cases/errors/only-natural-numbers-error.ts
var OnlyNaturalNumbersError = class extends Error {
  constructor() {
    super("Apenas numeros naturais");
  }
};

// src/use-cases/errors/insufficient-stock-error.ts
var InsufficientStockError = class extends Error {
  constructor(message) {
    super(message || "Estoquel insuficiente.");
  }
};

// src/use-cases/treatmentItem.ts
var TreatmentItemUseCase = class {
  constructor(treatmentItemsRepository, treatmentsRepository, itemsRepository, stocksRepository) {
    this.treatmentItemsRepository = treatmentItemsRepository;
    this.treatmentsRepository = treatmentsRepository;
    this.itemsRepository = itemsRepository;
    this.stocksRepository = stocksRepository;
  }
  async execute({
    item_id,
    treatment_id,
    stock_id,
    quantity,
    salesValue,
    discount
  }) {
    let item;
    if (item_id) {
      item = await this.itemsRepository.findById(item_id);
      if (!item)
        throw new ResourceNotFoundError();
    }
    let treatment;
    if (treatment_id) {
      treatment = await this.treatmentsRepository.findById(treatment_id);
      if (!treatment)
        throw new ResourceNotFoundError();
    }
    let stock;
    if (stock_id) {
      stock = await this.stocksRepository.findById(stock_id);
      if (!stock)
        throw new ResourceNotFoundError();
    }
    if (quantity <= 0 || salesValue < 0)
      throw new OnlyNaturalNumbersError();
    const isService = !item?.isItem || item?.name?.toLowerCase().includes("clonagem") || item?.category?.toLowerCase().includes("servi");
    if (item && !isService && item.stock !== null && quantity > item.stock) {
      console.error(`[TreatmentItemUseCase] Stock Blocked: Item ${item.name} (isItem: ${item.isItem}), Stock: ${item.stock}, Req: ${quantity}`);
      throw new InsufficientStockError(`Estoque insuficiente. Dispon\xEDvel: ${item.stock}, Requisitado: ${quantity}`);
    }
    const treatmentItem = await this.treatmentItemsRepository.create({
      treatment_id,
      item_id,
      stock_id,
      quantity,
      salesValue,
      discount
    });
    return {
      treatmentItem
    };
  }
};

// src/repositories/prisma/prisma-items-repository.ts
var PrismaItemsRepository = class {
  async create(data, tx) {
    const client = tx ?? prisma;
    const item = await client.item.create({
      data
    });
    return item;
  }
  async findByName(name, is_active) {
    let item;
    if (is_active) {
      item = await prisma.item.findMany({
        where: {
          AND: [
            { name },
            { active: is_active }
          ]
        }
      });
    } else {
      item = await prisma.item.findMany({
        where: {
          name
        }
      });
    }
    if (item.length === 0)
      return null;
    return item;
  }
  async findById(id) {
    const item = await prisma.item.findFirst({
      where: {
        id
      }
    });
    return item;
  }
  async findMany(is_active, is_product, pageIndex, perPage, name, display_id, below_min_stock) {
    const page = Math.max(1, pageIndex || 1);
    const limit = perPage || 10;
    const skip = (page - 1) * limit;
    const where = {};
    if (is_active !== void 0) where.active = is_active;
    if (is_product !== void 0) where.isItem = is_product;
    if (name) where.name = { contains: name, mode: "insensitive" };
    if (display_id) where.display_id = display_id;
    if (below_min_stock) {
      const criticalItems = await prisma.$queryRaw`
                SELECT id FROM items WHERE stock <= min_stock AND "isItem" = true
             `;
      const criticalIds = criticalItems.map((i) => i.id);
      if (where.id) {
        where.AND = [
          ...Array.isArray(where.AND) ? where.AND : [],
          { id: { in: criticalIds } }
        ];
      } else {
        where.id = { in: criticalIds };
      }
    }
    const [items, totalCount] = await Promise.all([
      prisma.item.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: "asc"
        }
      }),
      prisma.item.count({
        where
      })
    ]);
    return {
      items,
      meta: {
        totalCount,
        perPage: limit,
        pageIndex: page
      }
    };
  }
  async update(data, tx) {
    const client = tx ?? prisma;
    const item = await client.item.update({
      where: {
        id: data.id
      },
      data
    });
    return item;
  }
  async remove(id, tx) {
    const client = tx ?? prisma;
    await client.item.delete({
      where: {
        id
      }
    });
  }
  async changeStock(id, stock, operationType, tx) {
    const client = tx ?? prisma;
    await client.item.update({
      where: { id },
      data: {
        stock: operationType ? { increment: stock } : { decrement: stock }
      }
    });
  }
  async setActive(id, commutator, tx) {
    const client = tx ?? prisma;
    const findedStock = await client.item.findFirst({
      where: {
        id
      }
    });
    if (findedStock)
      await client.item.update({
        where: {
          id
        },
        data: {
          active: commutator
        }
      });
  }
  async findMaxDisplayId() {
    const item = await prisma.item.findFirst({
      orderBy: {
        // @ts-ignore
        display_id: "desc"
      }
    });
    return item?.display_id ?? 0;
  }
  async findNextAvailableDisplayId(tx) {
    const client = tx ?? prisma;
    const first = await client.item.findUnique({
      where: { display_id: 1 }
    });
    if (!first) return 1;
    const result = await client.$queryRaw`
            SELECT (t1.display_id + 1) as next_id 
            FROM items t1 
            LEFT JOIN items t2 ON t1.display_id + 1 = t2.display_id 
            WHERE t2.display_id IS NULL 
            ORDER BY t1.display_id ASC 
            LIMIT 1
        `;
    if (result.length > 0) {
      return result[0].next_id;
    }
    const max = await this.findMaxDisplayId();
    return max + 1;
  }
};

// src/repositories/prisma/prisma-stocks-repository.ts
var import_client2 = require("@prisma/client");
var PrismaStocksRepository = class {
  async getItemHistory(item_id, start_date, end_date) {
    const where = { item_id };
    if (start_date) {
      where.created_at = { gte: start_date };
    }
    if (end_date) {
      where.created_at = { ...where.created_at, lte: end_date };
    }
    const stocks = await prisma.stock.findMany({
      where
    });
    return stocks;
  }
  async getItemBalance(item_id) {
    const inputStocks = await prisma.stock.aggregate({
      _sum: {
        quantity: true
        // Select the quantity field for summation
      },
      where: {
        item_id,
        operation: import_client2.StockOperation.IN
      }
    });
    const outputStocks = await prisma.stock.aggregate({
      _sum: {
        quantity: true
        // Select the quantity field for summation
      },
      where: {
        item_id,
        operation: import_client2.StockOperation.OUT
      }
    });
    const result = Number(inputStocks._sum.quantity) - Number(outputStocks._sum.quantity);
    return result;
  }
  update(data, tx) {
    throw new Error("Method not implemented.");
  }
  async delete(id, tx) {
    const client = tx ?? prisma;
    await client.stock.delete({
      where: {
        id
      }
    });
  }
  async create(data, tx) {
    const client = tx ?? prisma;
    const stock = await client.stock.create({
      data
    });
    return stock;
  }
  async findById(id) {
    const stock = await prisma.stock.findFirst({
      where: {
        id
      }
    });
    return stock;
  }
};

// src/use-cases/factories/make-treatment-item-use-case.ts
function MakeTreatmentItemUseCase() {
  const treatmentItemsRepository = new PrismaTreatmentItemsRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const itemsRepository = new PrismaItemsRepository();
  const stocksRepository = new PrismaStocksRepository();
  const treatmentItemUseCase = new TreatmentItemUseCase(
    treatmentItemsRepository,
    treatmentsRepository,
    itemsRepository,
    stocksRepository
  );
  return treatmentItemUseCase;
}

// src/http/controllers/treatments/treatment-item.ts
var import_zod3 = require("zod");
async function createItemTreatment(request, reply) {
  const registerBodySchema = import_zod3.z.object({
    treatment_id: import_zod3.z.string(),
    item_id: import_zod3.z.string(),
    stock_id: import_zod3.z.string().nullish(),
    quantity: import_zod3.z.number(),
    value: import_zod3.z.number(),
    discount: import_zod3.z.number().nullish()
  });
  console.log("Controller createItemTreatment body:", request.body);
  const { treatment_id, item_id, stock_id, quantity, value, discount } = registerBodySchema.parse(request.body);
  let itemTreatment;
  try {
    const itemtreatmentUseCase = MakeTreatmentItemUseCase();
    itemTreatment = await itemtreatmentUseCase.execute({
      treatment_id,
      item_id,
      stock_id: stock_id ? stock_id : void 0,
      quantity,
      salesValue: value,
      discount: discount ? discount : 0
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return reply.status(400).send({ message: err.message });
    }
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(itemTreatment);
}

// src/use-cases/get-treatments.ts
var GetTreatmentsUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({ pageIndex, perPage, treatmentId, clientName, status }) {
    if (!perPage)
      perPage = 6;
    try {
      const result = await this.treatmentsRepository.findByActive(pageIndex, perPage, treatmentId, clientName, status);
      return result;
    } catch (error) {
      console.error("[GetTreatmentsUseCase] Error executing repository query:", error);
      return null;
    }
  }
};

// src/use-cases/factories/make-get-treatments-use-case.ts
function MakeGetTreatmentsUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const getTreatmentUseCase = new GetTreatmentsUseCase(treatmentsRepository);
  return getTreatmentUseCase;
}

// src/http/controllers/treatments/getTreatments.ts
var import_zod4 = require("zod");
async function getTreatments(request, reply) {
  try {
    console.log("[GetTreatments] Query Params:", request.query);
    const getTreatmentsParamsSchema = import_zod4.z.object({
      page: import_zod4.z.coerce.string().default("1"),
      treatmentId: import_zod4.z.string().nullish(),
      clientName: import_zod4.z.string().nullish(),
      status: import_zod4.z.string().nullish()
    });
    const { page, treatmentId, clientName, status } = getTreatmentsParamsSchema.parse(request.query);
    const getTreatmentUseCase = MakeGetTreatmentsUseCase();
    const result = await getTreatmentUseCase.execute({
      pageIndex: parseInt(page),
      treatmentId: treatmentId || void 0,
      // Convert null/empty to undefined
      clientName: clientName || void 0,
      status: status || void 0
    });
    if (!result) {
      return reply.status(200).send({ treatments: [], totalCount: 0, perPage: 10, pageIndex: 1 });
    }
    return reply.status(200).send(result);
  } catch (err) {
    console.error("[GetTreatments] Error:", err);
    if (err instanceof Error) {
      return reply.status(500).send({ message: err.message });
    }
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

// src/use-cases/remove-treatment-item.ts
var RemoveTreatmentItemUseCase = class {
  constructor(treatmentItemsRepository, treatmentsRepository) {
    this.treatmentItemsRepository = treatmentItemsRepository;
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    id
  }) {
    const treatmentItem = await this.treatmentItemsRepository.findById(id);
    if (!treatmentItem) {
      throw new ResourceNotFoundError();
    } else {
      await this.treatmentItemsRepository.remove(id);
    }
  }
};

// src/use-cases/factories/make-remove-treatment-item-use-case.ts
function MakeRemoveTreatmentItemUseCase() {
  const treatmentItemsRepository = new PrismaTreatmentItemsRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const treatmentItemUseCase = new RemoveTreatmentItemUseCase(
    treatmentItemsRepository,
    treatmentsRepository
  );
  return treatmentItemUseCase;
}

// src/http/controllers/treatments/remove-treatment-item.ts
var import_zod5 = require("zod");
async function RemoveTreatmentItem(request, reply) {
  const deleteItemTreatmentParamsSchema = import_zod5.z.object({
    id: import_zod5.z.string().uuid()
  });
  console.log(request);
  const { id } = deleteItemTreatmentParamsSchema.parse(request.params);
  try {
    const removeTreatmentItemUseCase = MakeRemoveTreatmentItemUseCase();
    await removeTreatmentItemUseCase.execute({
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

// src/http/controllers/treatments/getTreatment.ts
var import_zod6 = require("zod");

// src/use-cases/get-treatment.ts
var GetTreatmentUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({ treatmentId }) {
    const treatment = await this.treatmentsRepository.findById(treatmentId);
    return treatment;
  }
};

// src/use-cases/factories/make-get-treatment-use-case.ts
function MakeGetTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const getTreatmentUseCase = new GetTreatmentUseCase(treatmentsRepository);
  return getTreatmentUseCase;
}

// src/http/controllers/treatments/getTreatment.ts
async function getTreatment(request, reply) {
  const getTreatmentsParamsSchema = import_zod6.z.object({
    id: import_zod6.z.string().uuid()
  });
  const { id } = getTreatmentsParamsSchema.parse(request.params);
  let treatments;
  try {
    const getTreatmentUseCase = MakeGetTreatmentUseCase();
    treatments = await getTreatmentUseCase.execute({
      treatmentId: id
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send({
    treatments
  });
}

// src/use-cases/update-treatment.ts
var UpdateTreatmentUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    id,
    opening_date,
    ending_date,
    contact,
    user_id,
    client_id,
    equipment_id,
    request,
    status,
    observations
  }) {
    const treatment = await this.treatmentsRepository.update(id, {
      opening_date,
      ending_date,
      contact,
      user_id,
      client_id,
      equipment_id,
      request,
      status,
      observations
    });
    return {
      treatment
    };
  }
};

// src/use-cases/factories/make-update-treatment-use-case.ts
function MakeUpdateTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const registerUseCase = new UpdateTreatmentUseCase(treatmentsRepository);
  return registerUseCase;
}

// src/http/controllers/treatments/updateTreatment.ts
var import_zod7 = require("zod");
async function updateTreatment(request, reply) {
  const updateTreatmentBodySchema = import_zod7.z.object({
    opening_date: import_zod7.z.coerce.date().nullish(),
    ending_date: import_zod7.z.coerce.date().nullish(),
    contact: import_zod7.z.string().nullish(),
    user_id: import_zod7.z.string().nullish(),
    client_id: import_zod7.z.string().nullish(),
    equipment_id: import_zod7.z.string().nullish(),
    request: import_zod7.z.string().nullish(),
    status: import_zod7.z.string().nullish(),
    amount: import_zod7.z.number().nullish(),
    observations: import_zod7.z.string().nullish()
  });
  const idUpdateTreatmentBodySchema = import_zod7.z.object({
    id: import_zod7.z.string().uuid()
  });
  const {
    opening_date,
    ending_date,
    contact,
    user_id,
    client_id,
    equipment_id,
    status,
    observations
  } = updateTreatmentBodySchema.parse(request.body);
  const { id } = idUpdateTreatmentBodySchema.parse(request.params);
  const test = updateTreatmentBodySchema.parse(request.body);
  let treatment;
  try {
    const updateTreatmentUseCase = MakeUpdateTreatmentUseCase();
    treatment = await updateTreatmentUseCase.execute({
      id,
      opening_date: opening_date ? opening_date : void 0,
      ending_date: status === "resolved" ? /* @__PURE__ */ new Date() : ending_date ? ending_date : void 0,
      contact: contact ? contact : void 0,
      user_id: user_id ? user_id : void 0,
      client_id: client_id ? client_id : void 0,
      equipment_id: equipment_id ? equipment_id : void 0,
      request: test.request ? test.request : void 0,
      status: status ? status : void 0,
      observations: observations ? observations : void 0
    });
  } catch (err) {
    if (err) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(treatment);
}

// src/repositories/prisma/prisma-interactions-repository.ts
var PrismaInteractionsRepository = class {
  async create(data) {
    const interaction = await prisma.interaction.create({
      data
    });
    return interaction;
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    prisma.interaction.delete({
      where: {
        id
      }
    });
  }
  findByTreatment(treatment_id) {
    const interactions = prisma.interaction.findMany({
      where: {
        treatment_id
      }
    });
    return interactions;
  }
};

// src/use-cases/interaction.ts
var InteractionUseCase = class {
  constructor(interactionsRepository, usersRepository, treatmentsRepository) {
    this.interactionsRepository = interactionsRepository;
    this.usersRepository = usersRepository;
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    user_id,
    treatment_id,
    date,
    description
  }) {
    const user = await this.usersRepository.findById(user_id);
    if (!user) {
      console.log("usuario n\xE3o encontrado");
      throw new ResourceNotFoundError();
    }
    const treatment = await this.treatmentsRepository.findById(treatment_id);
    if (!treatment) {
      console.log("atendimento n\xE3o encontrado");
      throw new ResourceNotFoundError();
    }
    const interaction = await this.interactionsRepository.create({
      user_id,
      treatment_id,
      date,
      description
    });
    return {
      interaction
    };
  }
};

// src/use-cases/factories/make-interaction-use-case.ts
function MakeInteractionUseCase() {
  const interactionsRepository = new PrismaInteractionsRepository();
  const usersRepository = new PrismaUsersRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const interactionUseCase = new InteractionUseCase(interactionsRepository, usersRepository, treatmentsRepository);
  return interactionUseCase;
}

// src/http/controllers/treatments/interaction.ts
var import_zod8 = require("zod");
async function createInteraction(request, reply) {
  const createInteractionParams = import_zod8.z.object({
    id: import_zod8.z.string().uuid()
  });
  const createInteractionBodySchema = import_zod8.z.object({
    date: import_zod8.z.coerce.date().nullish(),
    description: import_zod8.z.string()
  });
  const { date, description } = createInteractionBodySchema.parse(request.body);
  const { id } = createInteractionParams.parse(request.params);
  let interaction;
  try {
    const interactionUseCase = MakeInteractionUseCase();
    interaction = await interactionUseCase.execute({
      user_id: request.user.sub,
      treatment_id: id,
      date: date ? date : /* @__PURE__ */ new Date(),
      description
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(interaction);
}

// src/repositories/prisma/prisma-service-management-repository.ts
var PrismaServiceManagementRepository = class {
  async getServiceManagementData() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const totalTreatments = await prisma.treatment.count({
      where: {
        opening_date: {
          gte: startOfMonth,
          lt: startOfNextMonth
        }
      }
    });
    const completedTreatments = await prisma.treatment.count({
      where: {
        AND: [
          {
            ending_date: {
              gte: startOfMonth,
              lt: startOfNextMonth
            }
          },
          {
            status: "resolved"
          }
        ]
      }
    });
    const inWorkbench = await prisma.treatment.count({
      where: {
        status: "in_workbench"
      }
    });
    const externalOpen = await prisma.treatment.count({
      where: {
        status: {
          in: ["pending", "in_progress", "follow_up"]
        }
      }
    });
    const averageTreatmentTime = await this.calculateAverageTreatmentTime(startOfMonth, startOfNextMonth);
    return {
      totalTreatments,
      completedTreatments,
      inWorkbench,
      externalOpen,
      averageTreatmentTime
    };
  }
  async calculateAverageTreatmentTime(startOfMonth, startOfNextMonth) {
    const allTreatments = await prisma.treatment.findMany({
      where: {
        opening_date: {
          gte: startOfMonth,
          lt: startOfNextMonth
        }
      },
      select: {
        opening_date: true,
        ending_date: true,
        status: true
      }
    });
    if (allTreatments.length === 0) {
      return 0;
    }
    const now = (/* @__PURE__ */ new Date()).getTime();
    const totalTime = allTreatments.reduce((sum, treatment) => {
      const start = treatment.opening_date.getTime();
      const end = treatment.ending_date ? treatment.ending_date.getTime() : now;
      const durationInMinutes = (end - start) / (1e3 * 60);
      return sum + durationInMinutes;
    }, 0);
    return Math.round(totalTime / allTreatments.length);
  }
};

// src/use-cases/get-service-management-data.ts
var GetServiceManagementDataUseCase = class {
  constructor(serviceManagementRepository) {
    this.serviceManagementRepository = serviceManagementRepository;
  }
  async execute() {
    const serviceData = await this.serviceManagementRepository.getServiceManagementData();
    return { serviceData };
  }
};

// src/use-cases/factories/make-get-service-management-data-use-case.ts
function MakeGetServiceManagementDataUseCase() {
  const serviceManagementRepository = new PrismaServiceManagementRepository();
  const getServiceManagementDataUseCase = new GetServiceManagementDataUseCase(serviceManagementRepository);
  return getServiceManagementDataUseCase;
}

// src/http/controllers/treatments/get-service-management-data.ts
async function getServiceManagementData(request, reply) {
  let serviceData;
  try {
    const getServiceManagementDataUseCase = MakeGetServiceManagementDataUseCase();
    serviceData = await getServiceManagementDataUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(serviceData);
}

// src/http/controllers/treatments/finish.ts
var import_zod9 = require("zod");

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

// src/use-cases/factories/make-finish-treatment-use-case.ts
function MakeFinishTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const paymentEntrysRepository = new PrismaPaymentEntrysRepository();
  const itemsRepository = new PrismaItemsRepository();
  const transactionsRepository = new PrismaTransactionsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const finishTreatmentUseCase = new FinishTreatmentUseCase(
    treatmentsRepository,
    paymentEntrysRepository,
    itemsRepository,
    transactionsRepository,
    accountsRepository
  );
  return finishTreatmentUseCase;
}

// src/http/controllers/treatments/finish.ts
async function finish(request, reply) {
  const finishTreatmentParamsSchema = import_zod9.z.object({
    id: import_zod9.z.string().uuid()
  });
  const { id } = finishTreatmentParamsSchema.parse(request.params);
  try {
    const finishTreatmentUseCase = MakeFinishTreatmentUseCase();
    await finishTreatmentUseCase.execute({
      treatment_id: id
    });
    return reply.status(200).send({ message: "Treatment finished successfully" });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    if (err instanceof Error) {
      return reply.status(400).send({ message: err.message });
    }
    throw err;
  }
}

// src/http/controllers/treatments/routes.ts
async function treatmentsRoutes(app) {
  app.addHook("onRequest", verifyJWT);
  app.get("/treatments", getTreatments);
  app.get("/treatment/:id", getTreatment);
  app.patch("/treatment/:id", updateTreatment);
  app.post("/treatment/:id/interaction", createInteraction);
  app.post("/treatment", createTreatment);
  app.post("/treatment-item", createItemTreatment);
  app.delete("/treatment-item/:id", RemoveTreatmentItem);
  app.patch("/treatment/:id/finish", finish);
  app.get("/service-management", getServiceManagementData);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  treatmentsRoutes
});
