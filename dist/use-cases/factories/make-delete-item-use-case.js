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

// src/use-cases/factories/make-delete-item-use-case.ts
var make_delete_item_use_case_exports = {};
__export(make_delete_item_use_case_exports, {
  makeDeleteItemUseCase: () => makeDeleteItemUseCase
});
module.exports = __toCommonJS(make_delete_item_use_case_exports);

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

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  makeDeleteItemUseCase
});
