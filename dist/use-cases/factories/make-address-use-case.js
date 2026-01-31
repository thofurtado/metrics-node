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

// src/use-cases/factories/make-address-use-case.ts
var make_address_use_case_exports = {};
__export(make_address_use_case_exports, {
  MakeAddressuseCase: () => MakeAddressuseCase
});
module.exports = __toCommonJS(make_address_use_case_exports);

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

// src/repositories/prisma/prisma-addresses-repository.ts
var PrismaAddressesRepository = class {
  update(data) {
    throw new Error("Method not implemented.");
  }
  async findByDetails(neighborhood, city) {
    throw new Error("Method not implemented.");
  }
  async findByClientId(client_id) {
    const address = await prisma.address.findMany({
      where: {
        client_id
      }
    });
    return address;
  }
  async create(data) {
    const address = await prisma.address.create({
      data
    });
    return address;
  }
};

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/address.ts
var AddressUseCase = class {
  constructor(addressRepository, clientsRepository) {
    this.addressRepository = addressRepository;
    this.clientsRepository = clientsRepository;
  }
  async execute({
    street,
    number,
    neighborhood,
    city,
    state,
    zipcode,
    client_id
  }) {
    const client = await this.clientsRepository.findById(client_id);
    if (!client) {
      throw new ResourceNotFoundError();
    }
    const address = await this.addressRepository.create({
      street,
      number,
      neighborhood,
      city,
      state,
      zipcode,
      client_id
    });
    return {
      address
    };
  }
};

// src/repositories/prisma/prisma-clients-repository.ts
var PrismaClientsRepository = class {
  async findByName(name) {
    throw new Error("Method not implemented.");
  }
  async findMany(is_contract) {
    const clients = await prisma.client.findMany({
      include: {
        equipments: true,
        addresses: true
      },
      orderBy: [
        {
          name: "asc"
        }
      ]
    });
    return clients;
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    throw new Error("Method not implemented.");
  }
  async findById(id) {
    const client = await prisma.client.findUnique({
      where: {
        id
      }
    });
    return client;
  }
  async create(data) {
    const client = await prisma.client.create({
      data
    });
    return client;
  }
};

// src/use-cases/factories/make-address-use-case.ts
function MakeAddressuseCase() {
  const addressesRepository = new PrismaAddressesRepository();
  const clientsRepository = new PrismaClientsRepository();
  const addressUseCase = new AddressUseCase(addressesRepository, clientsRepository);
  return addressUseCase;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MakeAddressuseCase
});
