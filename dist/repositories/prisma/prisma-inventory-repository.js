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

// src/repositories/prisma/prisma-inventory-repository.ts
var prisma_inventory_repository_exports = {};
__export(prisma_inventory_repository_exports, {
  PrismaInventoryRepository: () => PrismaInventoryRepository
});
module.exports = __toCommonJS(prisma_inventory_repository_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PrismaInventoryRepository
});
