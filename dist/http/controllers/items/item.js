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

// src/http/controllers/items/item.ts
var item_exports = {};
__export(item_exports, {
  createItem: () => createItem
});
module.exports = __toCommonJS(item_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createItem
});
