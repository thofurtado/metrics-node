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

// src/use-cases/item.ts
var item_exports = {};
__export(item_exports, {
  ItemUseCase: () => ItemUseCase
});
module.exports = __toCommonJS(item_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ItemUseCase
});
