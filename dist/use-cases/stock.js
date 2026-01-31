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

// src/use-cases/stock.ts
var stock_exports = {};
__export(stock_exports, {
  StockUseCase: () => StockUseCase
});
module.exports = __toCommonJS(stock_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StockUseCase
});
