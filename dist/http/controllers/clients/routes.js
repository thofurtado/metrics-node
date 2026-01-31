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

// src/http/controllers/clients/routes.ts
var routes_exports = {};
__export(routes_exports, {
  clientsRoutes: () => clientsRoutes
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

// src/use-cases/client.ts
var ClientUseCase = class {
  constructor(clientsRepository) {
    this.clientsRepository = clientsRepository;
  }
  async execute({
    name,
    email,
    identification,
    phone,
    contract,
    contact,
    isEnterprise
  }) {
    const client = await this.clientsRepository.create({
      name,
      email,
      identification,
      phone,
      contract,
      contact,
      isEnterprise
    });
    return {
      client
    };
  }
};

// src/use-cases/factories/make-client-use-case.ts
function MakeClientuseCase() {
  const clientsRepository = new PrismaClientsRepository();
  const clientUseCase = new ClientUseCase(clientsRepository);
  return clientUseCase;
}

// src/http/controllers/clients/client.ts
var import_zod2 = require("zod");
async function createClient(request, reply) {
  const registerBodySchema = import_zod2.z.object({
    name: import_zod2.z.string(),
    identification: import_zod2.z.string().nullish(),
    phone: import_zod2.z.string().nullish(),
    email: import_zod2.z.string().nullish(),
    contract: import_zod2.z.boolean().nullish(),
    contact: import_zod2.z.string().nullish(),
    isEnterprise: import_zod2.z.boolean().nullish()
  });
  const { name, identification, phone, email, contract, contact, isEnterprise } = registerBodySchema.parse(request.body);
  let client;
  try {
    const clientUseCase = MakeClientuseCase();
    client = await clientUseCase.execute({
      name,
      identification: identification ? identification : void 0,
      phone: phone ? phone : void 0,
      email: email ? email : void 0,
      contract: contract ? contract : false,
      contact: contact ? contact : void 0,
      isEnterprise: isEnterprise ? isEnterprise : false
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(client);
}

// src/repositories/prisma/prisma-equipments-repository.ts
var PrismaEquipmentsRepository = class {
  async findById(id) {
    const equipment = await prisma.equipment.findUnique({
      where: { id }
    });
    return equipment;
  }
  async findByClientId(client_id) {
    const equipment = await prisma.equipment.findMany({
      where: { client_id }
    });
    return equipment;
  }
  async create(data) {
    const equipment = await prisma.equipment.create({
      data
    });
    return equipment;
  }
  findByClient(client_id) {
    const equiepments = prisma.equipment.findMany({
      where: {
        client_id
      }
    });
    return equiepments;
  }
  findMany(type, brand, identification) {
    const equiepments = prisma.equipment.findMany({
      where: {
        type,
        brand,
        identification
      }
    });
    return equiepments;
  }
};

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/equipment.ts
var EquipmentUseCase = class {
  constructor(equipmentRepository, clientRepository) {
    this.equipmentRepository = equipmentRepository;
    this.clientRepository = clientRepository;
  }
  async execute({
    type,
    brand,
    identification,
    details,
    entry,
    client_id
  }) {
    const client = await this.clientRepository.findById(client_id);
    if (!client) {
      throw new ResourceNotFoundError();
    }
    const equipment = await this.equipmentRepository.create({
      type,
      brand: brand || null,
      identification: identification || null,
      details: details || null,
      entry: new Date(entry),
      client_id
    });
    return {
      equipment
    };
  }
};

// src/use-cases/factories/make-equipment-use-case.ts
function MakeEquipmentuseCase() {
  const equipmentsRepository = new PrismaEquipmentsRepository();
  const clientsRepository = new PrismaClientsRepository();
  const equipmentUseCase = new EquipmentUseCase(equipmentsRepository, clientsRepository);
  return equipmentUseCase;
}

// src/http/controllers/clients/equipment.ts
var import_zod3 = require("zod");
async function createEquipment(request, reply) {
  const registerBodySchema = import_zod3.z.object({
    client_id: import_zod3.z.string(),
    type: import_zod3.z.string(),
    brand: import_zod3.z.string().nullish(),
    identification: import_zod3.z.string().nullish(),
    details: import_zod3.z.string().nullish(),
    entry: import_zod3.z.date().nullish()
  });
  const { client_id, type, brand, identification, details, entry } = registerBodySchema.parse(request.body);
  let equipment;
  try {
    const equipmentUseCase = MakeEquipmentuseCase();
    equipment = await equipmentUseCase.execute({
      client_id,
      type,
      brand: brand ? brand : void 0,
      identification: identification ? identification : void 0,
      details: details ? details : void 0,
      entry: entry ? entry : /* @__PURE__ */ new Date(" GMT-3")
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(equipment);
}

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

// src/use-cases/factories/make-address-use-case.ts
function MakeAddressuseCase() {
  const addressesRepository = new PrismaAddressesRepository();
  const clientsRepository = new PrismaClientsRepository();
  const addressUseCase = new AddressUseCase(addressesRepository, clientsRepository);
  return addressUseCase;
}

// src/http/controllers/clients/address.ts
var import_zod4 = require("zod");
async function createAddress(request, reply) {
  const registerBodySchema = import_zod4.z.object({
    client_id: import_zod4.z.string(),
    street: import_zod4.z.string(),
    number: import_zod4.z.number(),
    neighborhood: import_zod4.z.string(),
    city: import_zod4.z.string(),
    state: import_zod4.z.string(),
    zipcode: import_zod4.z.number().nullish()
  });
  const { client_id, street, number, neighborhood, city, state, zipcode } = registerBodySchema.parse(request.body);
  let address;
  try {
    const addressUseCase = MakeAddressuseCase();
    address = await addressUseCase.execute({
      client_id,
      street,
      number,
      neighborhood,
      city,
      state,
      zipcode: zipcode ? zipcode : 0
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(address);
}

// src/use-cases/get-clients.ts
var GetClientsUseCase = class {
  constructor(clientsRepository) {
    this.clientsRepository = clientsRepository;
  }
  async execute() {
    const clients = await this.clientsRepository.findMany();
    return {
      clients
    };
  }
};

// src/use-cases/factories/make-get-clients-use-case.ts
function MakeGetClientsUseCase() {
  const clientsRepository = new PrismaClientsRepository();
  const getClientUseCase = new GetClientsUseCase(clientsRepository);
  return getClientUseCase;
}

// src/http/controllers/clients/getClients.ts
async function getClient(request, reply) {
  let clients;
  try {
    const getClientUseCase = MakeGetClientsUseCase();
    clients = await getClientUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(clients);
}

// src/http/controllers/clients/routes.ts
async function clientsRoutes(app) {
  app.addHook("onRequest", verifyJWT);
  app.post("/client", createClient);
  app.post("/equipment", createEquipment);
  app.post("/address", createAddress);
  app.get("/clients", getClient);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  clientsRoutes
});
