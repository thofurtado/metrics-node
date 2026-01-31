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

// src/repositories/prisma/prisma-service-management-repository.ts
var prisma_service_management_repository_exports = {};
__export(prisma_service_management_repository_exports, {
  PrismaServiceManagementRepository: () => PrismaServiceManagementRepository
});
module.exports = __toCommonJS(prisma_service_management_repository_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PrismaServiceManagementRepository
});
