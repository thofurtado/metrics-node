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

// src/use-cases/factories/make-get-item-stocks-use-case.ts
var make_get_item_stocks_use_case_exports = {};
__export(make_get_item_stocks_use_case_exports, {
  MakeGetStocksUseCase: () => MakeGetStocksUseCase
});
module.exports = __toCommonJS(make_get_item_stocks_use_case_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakeGetStocksUseCase
});
