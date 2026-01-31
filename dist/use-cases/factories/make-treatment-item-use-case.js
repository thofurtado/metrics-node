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

// src/use-cases/factories/make-treatment-item-use-case.ts
var make_treatment_item_use_case_exports = {};
__export(make_treatment_item_use_case_exports, {
  MakeTreatmentItemUseCase: () => MakeTreatmentItemUseCase
});
module.exports = __toCommonJS(make_treatment_item_use_case_exports);

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

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakeTreatmentItemUseCase
});
