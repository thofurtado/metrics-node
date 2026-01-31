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

// src/http/controllers/financial/sector.ts
var sector_exports = {};
__export(sector_exports, {
  createSector: () => createSector
});
module.exports = __toCommonJS(sector_exports);
var import_zod2 = require("zod");

// src/use-cases/errors/this-name-already-exists-error.ts
var ThisNameAlreadyExistsError = class extends Error {
  constructor() {
    super("Nome j\xE1 cadastrado");
  }
};

// src/use-cases/errors/invalid-option-error.ts
var InvalidOptionError = class extends Error {
  constructor() {
    super("Op\xE7\xE3o invalida");
  }
};

// src/use-cases/sector.ts
var SectorUseCase = class {
  constructor(sectorsRepository) {
    this.sectorsRepository = sectorsRepository;
  }
  async execute({
    name,
    budget,
    type
  }) {
    const sectorWithSameName = await this.sectorsRepository.findByName(name);
    if (sectorWithSameName !== null) {
      throw new ThisNameAlreadyExistsError();
    }
    if (type !== "in" && type !== "out") {
      throw new InvalidOptionError();
    }
    const sector = await this.sectorsRepository.create({
      name,
      budget,
      type
    });
    return {
      sector
    };
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

// src/repositories/prisma/prisma-sectors-repository.ts
var PrismaSectorsRepository = class {
  async findByName(name) {
    const sector = prisma.sector.findFirst({
      where: {
        name
      }
    });
    if (!sector) {
      return null;
    }
    return sector;
  }
  async create(data) {
    const sector = prisma.sector.create({
      data
    });
    return sector;
  }
  update(data) {
    throw new Error("Method not implemented.");
  }
  findById(id) {
    const sector = prisma.sector.findFirst({
      where: { id }
    });
    return sector;
  }
  async findMany() {
    const sectors = await prisma.sector.findMany({
      orderBy: [
        {
          name: "asc"
        }
      ]
    });
    return sectors;
  }
  compareBudget(month, sector_id) {
    throw new Error("Method not implemented.");
  }
};

// src/use-cases/factories/make-sector-use-case.ts
function MakeSectorUseCase() {
  const sectorsRepository = new PrismaSectorsRepository();
  const sectorUseCase = new SectorUseCase(sectorsRepository);
  return sectorUseCase;
}

// src/http/controllers/financial/sector.ts
async function createSector(request, reply) {
  try {
    console.log("[CreateSector] Payload:", JSON.stringify(request.body, null, 2));
    const registerBodySchema = import_zod2.z.object({
      name: import_zod2.z.string(),
      budget: import_zod2.z.number().nullable().optional(),
      type: import_zod2.z.string()
    });
    const { name, budget, type } = registerBodySchema.parse(request.body);
    const sectorUseCase = MakeSectorUseCase();
    const { sector } = await sectorUseCase.execute({
      name,
      budget: budget ?? void 0,
      type
    });
    return reply.status(201).send(sector);
  } catch (err) {
    console.error("[CreateSector] Error:", err);
    if (err instanceof import_zod2.z.ZodError) {
      return reply.status(400).send({ message: "Validation error", issues: err.format() });
    }
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createSector
});
