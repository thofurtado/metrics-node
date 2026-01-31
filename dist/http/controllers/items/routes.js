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

// src/http/controllers/items/routes.ts
var routes_exports = {};
__export(routes_exports, {
  itemsRoutes: () => itemsRoutes
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

// src/use-cases/errors/this-name-already-exists-error.ts
var ThisNameAlreadyExistsError = class extends Error {
  constructor() {
    super("Nome j\xE1 cadastrado");
  }
};

// src/use-cases/errors/price-cannot-be-lower-than-cost-error.ts
var PriceCannotBeLowerThanCost = class extends Error {
  constructor() {
    super("Custo n\xE3o pode ser menor que valor de venda");
  }
};

// src/use-cases/errors/only-natural-numbers-error.ts
var OnlyNaturalNumbersError = class extends Error {
  constructor() {
    super("Apenas numeros naturais");
  }
};

// src/use-cases/errors/display-id-already-exists-error.ts
var DisplayIdAlreadyExistsError = class extends Error {
  constructor() {
    super("Display ID already exists.");
  }
};

// src/use-cases/item.ts
var ItemUseCase = class {
  constructor(itemsRepository, stockRepository) {
    this.itemsRepository = itemsRepository;
    this.stockRepository = stockRepository;
  }
  async execute({
    name,
    description,
    cost,
    price,
    stock,
    min_stock,
    barcode,
    category,
    active,
    isItem,
    display_id
  }) {
    const existentName = await this.itemsRepository.findByName(name);
    if (existentName) {
      throw new ThisNameAlreadyExistsError();
    }
    if (display_id) {
      const existingWithId = await this.itemsRepository.findMany(void 0, void 0, 1, 1, void 0, display_id);
      if (existingWithId && existingWithId.items && existingWithId.items.length > 0) {
        throw new DisplayIdAlreadyExistsError();
      }
    }
    if (price < cost)
      throw new PriceCannotBeLowerThanCost();
    if (cost < 0 || price < 0)
      throw new OnlyNaturalNumbersError();
    return await prisma.$transaction(async (tx) => {
      if (stock) {
        if (stock < 0)
          throw new OnlyNaturalNumbersError();
        let finalDisplayId2 = display_id;
        if (!finalDisplayId2 || isNaN(finalDisplayId2)) {
          finalDisplayId2 = await this.itemsRepository.findNextAvailableDisplayId(tx);
        }
        const item2 = await this.itemsRepository.create({
          name,
          description,
          cost,
          price,
          stock,
          min_stock,
          barcode,
          category,
          active,
          isItem,
          display_id: finalDisplayId2
        }, tx);
        if (stock !== 0)
          await this.stockRepository.create({
            item_id: item2.id,
            quantity: stock,
            operation: "IN",
            description: "AJUSTE_POSITIVO",
            created_at: /* @__PURE__ */ new Date()
          }, tx);
        return {
          item: item2
        };
      }
      let finalDisplayId = display_id;
      if (!finalDisplayId || isNaN(finalDisplayId)) {
        finalDisplayId = await this.itemsRepository.findNextAvailableDisplayId(tx);
      }
      const item = await this.itemsRepository.create({
        name,
        description,
        cost,
        price,
        stock: 0,
        min_stock,
        barcode,
        category,
        active,
        isItem,
        display_id: finalDisplayId
      }, tx);
      return {
        item
      };
    });
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

// src/use-cases/factories/make-item-use-case.ts
function MakeItemUseCase() {
  const itemsRepository = new PrismaItemsRepository();
  const stocksRepository = new PrismaStocksRepository();
  const itemUseCase = new ItemUseCase(itemsRepository, stocksRepository);
  return itemUseCase;
}

// src/http/controllers/items/item.ts
var import_zod2 = require("zod");
async function createItem(request, reply) {
  const registerBodySchema = import_zod2.z.object({
    name: import_zod2.z.string(),
    description: import_zod2.z.string().nullish(),
    cost: import_zod2.z.number(),
    price: import_zod2.z.number(),
    stock: import_zod2.z.number().nullish(),
    min_stock: import_zod2.z.number().nullish(),
    barcode: import_zod2.z.string().nullish(),
    category: import_zod2.z.string().nullish(),
    active: import_zod2.z.boolean().nullish(),
    isItem: import_zod2.z.boolean().nullish(),
    display_id: import_zod2.z.preprocess((val) => val === "" ? null : Number(val), import_zod2.z.number().nullable().optional())
  }).refine((data) => {
    const isProduct = data.isItem !== false;
    if (isProduct && (data.min_stock === void 0 || data.min_stock === null)) {
      return false;
    }
    return true;
  }, {
    message: "Estoque m\xEDnimo \xE9 obrigat\xF3rio para produtos",
    path: ["min_stock"]
  });
  const { name, description, cost, price, stock, min_stock, barcode, category, active, isItem, display_id } = registerBodySchema.parse(request.body);
  let item;
  try {
    const itemUseCase = MakeItemUseCase();
    item = await itemUseCase.execute({
      name,
      description: description ? description : void 0,
      cost,
      price,
      stock: stock ? stock : void 0,
      min_stock: min_stock ? min_stock : void 0,
      barcode: barcode ? barcode : void 0,
      category: category ? category : void 0,
      active: active ? active : void 0,
      isItem: isItem ? isItem : void 0,
      display_id: display_id ? display_id : void 0
    });
  } catch (err) {
    if (err instanceof Error) {
      if ("code" in err && err.code === "P2002") {
        const target = err.meta?.target;
        if (Array.isArray(target)) {
          if (target.includes("display_id")) {
            return reply.status(400).send({ message: "Este c\xF3digo de identifica\xE7\xE3o j\xE1 est\xE1 em uso" });
          }
          if (target.includes("name")) {
            return reply.status(400).send({ message: "J\xE1 existe um item cadastrado com este nome" });
          }
        }
      }
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(item);
}

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/errors/invalid-option-error.ts
var InvalidOptionError = class extends Error {
  constructor() {
    super("Op\xE7\xE3o invalida");
  }
};

// src/use-cases/errors/stock-cannot-be-negative-error.ts
var StockCannotBeNegativaError = class extends Error {
  constructor() {
    super("O Estoque do produto n\xE3o pode ser negativo");
  }
};

// src/use-cases/stock.ts
var StockUseCase = class {
  constructor(stocksRepository, itemsRepository) {
    this.stocksRepository = stocksRepository;
    this.itemsRepository = itemsRepository;
  }
  async execute({
    item_id,
    quantity,
    operation,
    description,
    created_at
  }) {
    const findedItem = await this.itemsRepository.findById(item_id);
    if (!findedItem)
      throw new ResourceNotFoundError();
    if (quantity <= 0)
      throw new OnlyNaturalNumbersError();
    if (operation !== "IN" && operation !== "OUT")
      throw new InvalidOptionError();
    if (operation === "OUT") {
      const itemBalance = await this.stocksRepository.getItemBalance(item_id);
      if (itemBalance < quantity)
        throw new StockCannotBeNegativaError();
    }
    return await prisma.$transaction(async (tx) => {
      const stock = await this.stocksRepository.create({
        item_id,
        quantity,
        operation,
        // Cast to match Prisma Enum if needed, usually string works if valid
        description,
        created_at
      }, tx);
      await this.itemsRepository.changeStock(findedItem.id, quantity, operation === "IN" ? true : false, tx);
      return {
        stock
      };
    });
  }
};

// src/use-cases/factories/make-stock-use-case.ts
function MakeStockUseCase() {
  const stocksRepository = new PrismaStocksRepository();
  const itemsRepository = new PrismaItemsRepository();
  const stockUseCase = new StockUseCase(stocksRepository, itemsRepository);
  return stockUseCase;
}

// src/http/controllers/items/stock.ts
var import_zod3 = require("zod");
async function createStock(request, reply) {
  const registerBodySchema = import_zod3.z.object({
    item_id: import_zod3.z.string(),
    quantity: import_zod3.z.coerce.number(),
    operation: import_zod3.z.string(),
    description: import_zod3.z.string().nullish(),
    created_at: import_zod3.z.coerce.date().nullish()
  });
  const { item_id, quantity, operation, description, created_at } = registerBodySchema.parse(request.body);
  let stock;
  try {
    const stockUseCase = MakeStockUseCase();
    stock = await stockUseCase.execute({
      item_id,
      description: description ? description : void 0,
      quantity,
      operation,
      created_at: created_at ? created_at : void 0
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(stock);
}

// src/http/controllers/items/getItems.ts
var import_zod4 = require("zod");

// src/use-cases/get-items.ts
var GetItemsUseCase = class {
  constructor(itemsRepository) {
    this.itemsRepository = itemsRepository;
  }
  async execute({ page, limit, is_active, is_product, name, display_id, below_min_stock }) {
    const items = await this.itemsRepository.findMany(is_active, is_product, page, limit, name, display_id, below_min_stock);
    return items;
  }
};

// src/use-cases/factories/make-get-items-use-case.ts
function MakeGetItemsUseCase() {
  const itemsRepository = new PrismaItemsRepository();
  const getItemUseCase = new GetItemsUseCase(itemsRepository);
  return getItemUseCase;
}

// src/http/controllers/items/getItems.ts
async function getItems(request, reply) {
  const getItemsQuerySchema = import_zod4.z.object({
    page: import_zod4.z.coerce.number().optional().default(1),
    limit: import_zod4.z.coerce.number().optional().default(6),
    is_active: import_zod4.z.enum(["true", "false"]).optional().transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return void 0;
    }),
    is_product: import_zod4.z.enum(["true", "false"]).optional().transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return void 0;
    }),
    name: import_zod4.z.string().optional(),
    display_id: import_zod4.z.coerce.number().optional(),
    below_min_stock: import_zod4.z.enum(["true", "false"]).optional().transform((val) => val === "true")
  });
  const { page, limit, is_active, is_product, name, display_id, below_min_stock } = getItemsQuerySchema.parse(request.query);
  try {
    const getItemUseCase = MakeGetItemsUseCase();
    const result = await getItemUseCase.execute({
      page,
      limit,
      is_active,
      is_product,
      name,
      display_id,
      below_min_stock
    });
    return reply.status(200).send(result);
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
}

// src/use-cases/get-stock-by-item.ts
var GetStocksByItemUseCase = class {
  constructor(stocksRepository) {
    this.stocksRepository = stocksRepository;
  }
  async execute({ item_id }) {
    const stocks = await this.stocksRepository.getItemHistory(item_id);
    return {
      stocks
    };
  }
};

// src/use-cases/factories/make-get-item-stocks-use-case.ts
function MakeGetStocksUseCase() {
  const stocksRepository = new PrismaStocksRepository();
  const getStockUseCase = new GetStocksByItemUseCase(stocksRepository);
  return getStockUseCase;
}

// src/http/controllers/items/getItemHistory.ts
var import_zod5 = require("zod");
async function getItemHistory(request, reply) {
  const getItemStocksParamsSchema = import_zod5.z.object({
    id: import_zod5.z.string().uuid()
  });
  const { id } = getItemStocksParamsSchema.parse(request.params);
  let itemStocks;
  try {
    const getItemUseCase = MakeGetStocksUseCase();
    itemStocks = await getItemUseCase.execute(id);
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(itemStocks);
}

// src/http/controllers/items/updateItem.ts
var import_zod6 = require("zod");

// src/use-cases/update-item.ts
var UpdateItemUseCase = class {
  constructor(itemsRepository) {
    this.itemsRepository = itemsRepository;
  }
  async execute(data) {
    const item = await this.itemsRepository.update(data);
    return { item };
  }
};

// src/use-cases/factories/make-update-item-use-case.ts
function makeUpdateItemUseCase() {
  const itemsRepository = new PrismaItemsRepository();
  const useCase = new UpdateItemUseCase(itemsRepository);
  return useCase;
}

// src/http/controllers/items/updateItem.ts
async function updateItem(request, reply) {
  const updateItemParamsSchema = import_zod6.z.object({
    id: import_zod6.z.string().uuid()
  });
  const updateItemBodySchema = import_zod6.z.object({
    name: import_zod6.z.string().optional(),
    description: import_zod6.z.string().nullish(),
    cost: import_zod6.z.number().optional(),
    price: import_zod6.z.number().optional(),
    min_stock: import_zod6.z.number().nullish(),
    barcode: import_zod6.z.string().nullish(),
    category: import_zod6.z.string().nullish(),
    active: import_zod6.z.boolean().optional(),
    isItem: import_zod6.z.boolean().optional()
  });
  const { id } = updateItemParamsSchema.parse(request.params);
  const data = updateItemBodySchema.parse(request.body);
  try {
    const updateItemUseCase = makeUpdateItemUseCase();
    const { item } = await updateItemUseCase.execute({
      id,
      ...data,
      description: data.description ?? void 0,
      min_stock: data.min_stock ?? void 0,
      barcode: data.barcode ?? void 0,
      category: data.category ?? void 0
    });
    return reply.status(200).send(item);
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(400).send({ message: err.message });
    }
    throw err;
  }
}

// src/http/controllers/items/deleteItem.ts
var import_zod7 = require("zod");

// src/use-cases/delete-item.ts
var DeleteItemUseCase = class {
  constructor(itemsRepository, stocksRepository) {
    this.itemsRepository = itemsRepository;
    this.stocksRepository = stocksRepository;
  }
  async execute({ itemId }) {
    const item = await this.itemsRepository.findById(itemId);
    if (!item) {
      throw new ResourceNotFoundError();
    }
    const stockHistory = await this.stocksRepository.getItemHistory(itemId);
    if (stockHistory && stockHistory.length > 0) {
      throw new Error("Cannot delete item with stock history. Archive it instead.");
    }
    await this.itemsRepository.remove(itemId);
  }
};

// src/use-cases/factories/make-delete-item-use-case.ts
function makeDeleteItemUseCase() {
  const itemsRepository = new PrismaItemsRepository();
  const useCase = new DeleteItemUseCase(itemsRepository);
  return useCase;
}

// src/http/controllers/items/deleteItem.ts
async function deleteItem(request, reply) {
  const deleteItemParamsSchema = import_zod7.z.object({
    id: import_zod7.z.string().uuid()
  });
  const { id } = deleteItemParamsSchema.parse(request.params);
  try {
    const deleteItemUseCase = makeDeleteItemUseCase();
    await deleteItemUseCase.execute({ itemId: id });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(400).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/repositories/prisma/prisma-inventory-repository.ts
var PrismaInventoryRepository = class {
  async getInventorySummary() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const items = await prisma.item.findMany({
      where: {
        isItem: true,
        active: true
      },
      select: {
        stock: true,
        cost: true
      }
    });
    const patrimony = items.reduce((sum, item) => {
      const itemStock = item.stock || 0;
      const itemCost = item.cost || 0;
      return sum + itemStock * itemCost;
    }, 0);
    const salesStatuses = ["resolved", "finished"];
    const monthlyItems = await prisma.treatmentItem.findMany({
      where: {
        treatments: {
          opening_date: {
            gte: startOfMonth,
            lt: startOfNextMonth
          }
        }
      },
      select: {
        quantity: true,
        salesValue: true,
        discount: true,
        items: {
          select: {
            isItem: true
            // Para diferenciar Produto de Serviço
          }
        },
        treatments: {
          select: {
            status: true
            // Para diferenciar Venda de Orçamento
          }
        }
      }
    });
    let productsSoldValue = 0;
    let servicesSoldValue = 0;
    let productsBudgetValue = 0;
    let servicesBudgetValue = 0;
    for (const item of monthlyItems) {
      const quantity = item.quantity || 0;
      const salesValue = item.salesValue || 0;
      const discount = item.discount || 0;
      const totalItemValue = quantity * salesValue - discount;
      const isProduct = item.items.isItem === true;
      const isSale = item.treatments.status && (item.treatments.status === "resolved" || item.treatments.status === "finished");
      if (isProduct) {
        if (isSale) {
          productsSoldValue += totalItemValue;
        } else {
          productsBudgetValue += totalItemValue;
        }
      } else {
        if (isSale) {
          servicesSoldValue += totalItemValue;
        } else {
          servicesBudgetValue += totalItemValue;
        }
      }
    }
    return {
      patrimony,
      productsSold: Number(productsSoldValue.toFixed(2)),
      servicesSold: Number(servicesSoldValue.toFixed(2)),
      productsBudget: Number(productsBudgetValue.toFixed(2)),
      servicesBudget: Number(servicesBudgetValue.toFixed(2))
    };
  }
};

// src/use-cases/get-inventory-summary.ts
var GetInventorySummaryUseCase = class {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }
  async execute() {
    const inventorySummary = await this.inventoryRepository.getInventorySummary();
    return { inventorySummary };
  }
};

// src/use-cases/factories/make-get-inventory-summary-use-case.ts
function MakeGetInventorySummaryUseCase() {
  const inventoryRepository = new PrismaInventoryRepository();
  const getInventorySummaryUseCase = new GetInventorySummaryUseCase(inventoryRepository);
  return getInventorySummaryUseCase;
}

// src/http/controllers/items/get-inventory-summary.ts
async function getInventorySummary(request, reply) {
  let inventorySummary;
  try {
    const getInventorySummaryUseCase = MakeGetInventorySummaryUseCase();
    inventorySummary = await getInventorySummaryUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(inventorySummary);
}

// src/http/controllers/items/routes.ts
async function itemsRoutes(app) {
  app.addHook("onRequest", verifyJWT);
  app.post("/item", createItem);
  app.patch("/item/:id", updateItem);
  app.delete("/item/:id", deleteItem);
  app.post("/stock", createStock);
  app.get("/items", getItems);
  app.get("/item-stocks/:id", getItemHistory);
  app.get("/inventory-summary", getInventorySummary);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  itemsRoutes
});
