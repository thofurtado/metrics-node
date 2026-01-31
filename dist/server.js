"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/app.ts
var import_fastify = __toESM(require("fastify"));

// src/http/controllers/users/register.ts
var import_zod2 = require("zod");

// src/use-cases/errors/user-already-exists-error.ts
var UserAlreadyExistsError = class extends Error {
  constructor() {
    super("E-mail j\xE1 cadastrado");
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

// src/repositories/prisma/prisma-users-repository.ts
var PrismaUsersRepository = class {
  async update(id, data) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        introduction: data.introduction,
        password_hash: data.password_hash
      }
    });
    return user;
  }
  async findById(id) {
    const user = await prisma.user.findUnique({
      where: {
        id
      }
    });
    return user;
  }
  async findByEmail(email) {
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });
    return user;
  }
  async create(data) {
    const user = await prisma.user.create({
      data
    });
    return user;
  }
};

// src/use-cases/register.ts
var import_bcryptjs = require("bcryptjs");
var RegisterUseCase = class {
  constructor(usersRepository) {
    this.usersRepository = usersRepository;
  }
  async execute({
    name,
    email,
    password,
    role,
    introduction
  }) {
    const userWithSameEmail = await this.usersRepository.findByEmail(email);
    if (userWithSameEmail) {
      throw new UserAlreadyExistsError();
    }
    const password_hash = await (0, import_bcryptjs.hash)(password, 6);
    const user = await this.usersRepository.create({
      name,
      email,
      password_hash,
      role,
      introduction
    });
    return {
      user
    };
  }
};

// src/use-cases/factories/make-register-use-case.ts
function makeRegisteruseCase() {
  const usersRepository = new PrismaUsersRepository();
  const registerUseCase = new RegisterUseCase(usersRepository);
  return registerUseCase;
}

// src/http/controllers/users/register.ts
async function register(request, reply) {
  const registerBodySchema = import_zod2.z.object({
    name: import_zod2.z.string(),
    email: import_zod2.z.string().email(),
    password: import_zod2.z.string().min(6),
    introduction: import_zod2.z.string().nullish(),
    role: import_zod2.z.string().nullish()
  });
  const { name, email, password, introduction, role } = registerBodySchema.parse(request.body);
  try {
    const registerUseCase = makeRegisteruseCase();
    await registerUseCase.execute({
      name,
      email,
      password,
      introduction: introduction ? introduction : null,
      role: role ? role : void 0
    });
  } catch (err) {
    if (err instanceof UserAlreadyExistsError) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/users/authenticate.ts
var import_zod3 = require("zod");

// src/use-cases/errors/invalid-credentials-error.ts
var InvalidCredentialsError = class extends Error {
  constructor() {
    super("Credenciais inv\xE1lidas");
  }
};

// src/use-cases/authenticate.ts
var import_bcryptjs2 = require("bcryptjs");
var AuthenticateUseCase = class {
  constructor(usersRepository) {
    this.usersRepository = usersRepository;
  }
  async execute({ email, password }) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    const doesPasswordMatches = await (0, import_bcryptjs2.compare)(password, user.password_hash);
    if (!doesPasswordMatches) {
      throw new InvalidCredentialsError();
    }
    return {
      user
    };
  }
};

// src/use-cases/factories/make-authenticate-use-case.ts
function makeAuthenticateuseCase() {
  const usersRepository = new PrismaUsersRepository();
  const authenticateUseCase = new AuthenticateUseCase(usersRepository);
  return authenticateUseCase;
}

// src/http/controllers/users/authenticate.ts
async function authenticate(request, reply) {
  const authenticateBodySchema = import_zod3.z.object({
    email: import_zod3.z.string().email(),
    password: import_zod3.z.string().min(6)
  });
  const { email, password } = authenticateBodySchema.parse(request.body);
  try {
    const authenticateUseCase = makeAuthenticateuseCase();
    const { user } = await authenticateUseCase.execute({
      email,
      password
    });
    const token = await reply.jwtSign({
      role: user.role
    }, {
      sign: {
        sub: user.id,
        expiresIn: "7d"
      }
    });
    const refreshToken = await reply.jwtSign({
      role: user.role
    }, {
      sign: {
        sub: user.id,
        expiresIn: "7d"
      }
    });
    return reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      secure: true,
      sameSite: true,
      httpOnly: true
    }).status(200).send({ token, refreshToken });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return reply.status(400).send({ message: err.message });
    }
    throw err;
  }
}

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/get-user-profile.ts
var GetUserProfileUseCase = class {
  constructor(usersRepository) {
    this.usersRepository = usersRepository;
  }
  async execute({ userId }) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new ResourceNotFoundError();
    }
    return {
      user
    };
  }
};

// src/use-cases/factories/make-get-user-profile-use-case.ts
function makeGetUserProfileUseCase() {
  const usersRepository = new PrismaUsersRepository();
  const getUserProfileUseCase = new GetUserProfileUseCase(usersRepository);
  return getUserProfileUseCase;
}

// src/http/controllers/users/profile.ts
async function profile(request, reply) {
  const getUserProfile = makeGetUserProfileUseCase();
  const { user } = await getUserProfile.execute({
    userId: request.user.sub
  });
  reply.status(200).send({
    user: {
      ...user,
      password_hash: void 0
    }
  });
}

// src/http/middlewares/verify-jwt.ts
async function verifyJWT(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ message: "Desautorizado" });
  }
}

// src/http/controllers/users/refresh.ts
async function refresh(request, reply) {
  await request.jwtVerify({
    onlyCookie: true
  });
  const { role } = request.user;
  const token = await reply.jwtSign({
    role
  }, {
    sign: {
      sub: request.user.sub
    }
  });
  const refreshToken = await reply.jwtSign({ role }, {
    sign: {
      sub: request.user.sub,
      expiresIn: "7d"
    }
  });
  return reply.setCookie("refreshToken", refreshToken, {
    path: "/",
    secure: true,
    sameSite: true,
    httpOnly: true
  }).status(200).send({ token });
}

// src/http/controllers/users/update-profile.ts
var import_zod4 = require("zod");

// src/use-cases/update-profile.ts
var import_bcryptjs3 = require("bcryptjs");
var UpdateProfileUseCase = class {
  constructor(usersRepository) {
    this.usersRepository = usersRepository;
  }
  async execute({
    id,
    name,
    password,
    introduction
  }) {
    let password_hash;
    if (password)
      password_hash = await (0, import_bcryptjs3.hash)(password, 6);
    const user = await this.usersRepository.update(id, {
      name,
      password_hash,
      introduction
    });
    return {
      user
    };
  }
};

// src/use-cases/factories/make-update-profile-use-case.ts
function MakeUpdateProfileUseCase() {
  const usersRepository = new PrismaUsersRepository();
  const registerUseCase = new UpdateProfileUseCase(usersRepository);
  return registerUseCase;
}

// src/http/controllers/users/update-profile.ts
async function updateProfile(request, reply) {
  const updateProfileBodySchema = import_zod4.z.object({
    name: import_zod4.z.string().nullish(),
    password: import_zod4.z.string().min(6).nullish(),
    introduction: import_zod4.z.string().nullish()
  });
  const { name, password, introduction } = updateProfileBodySchema.parse(request.body);
  try {
    const updateProfileUseCase = MakeUpdateProfileUseCase();
    await updateProfileUseCase.execute({
      id: request.user.sub,
      name: name ? name : void 0,
      password: password ? password : void 0,
      introduction: introduction ? introduction : void 0
    });
  } catch (err) {
    if (err instanceof UserAlreadyExistsError) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/users/routes.ts
async function usersRoutes(app2) {
  app2.post("/users", register);
  app2.post("/sessions", authenticate);
  app2.patch("/token/refresh", refresh);
  app2.get("/me", { onRequest: [verifyJWT] }, profile);
  app2.put("/profile", { onRequest: [verifyJWT] }, updateProfile);
  app2.get("/health", async (request, reply) => {
    reply.status(200).send({ status: "ok" });
  });
}

// src/app.ts
var import_zod35 = require("zod");
var import_jwt = __toESM(require("@fastify/jwt"));

// src/http/controllers/financial/sector.ts
var import_zod5 = require("zod");

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
    const registerBodySchema = import_zod5.z.object({
      name: import_zod5.z.string(),
      budget: import_zod5.z.number().nullable().optional(),
      type: import_zod5.z.string()
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
    if (err instanceof import_zod5.z.ZodError) {
      return reply.status(400).send({ message: "Validation error", issues: err.format() });
    }
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

// src/use-cases/get-sectors.ts
var GetSectorsUseCase = class {
  constructor(sectorsRepository) {
    this.sectorsRepository = sectorsRepository;
  }
  async execute() {
    const sectors = await this.sectorsRepository.findMany();
    return {
      sectors
    };
  }
};

// src/use-cases/factories/make-get-sectors-use-case.ts
function MakeGetSectorsUseCase() {
  const sectorsRepository = new PrismaSectorsRepository();
  const getSectorUseCase = new GetSectorsUseCase(sectorsRepository);
  return getSectorUseCase;
}

// src/http/controllers/financial/getSector.ts
async function getSector(request, reply) {
  let sectors;
  try {
    const getSectorUseCase = MakeGetSectorsUseCase();
    sectors = await getSectorUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(sectors);
}

// src/repositories/prisma/prisma-accounts-repository.ts
var PrismaAccountsRepository = class {
  async findMany() {
    const accounts = await prisma.account.findMany({
      orderBy: [
        {
          name: "asc"
        }
      ]
    });
    return accounts;
  }
  async create(data) {
    const account = await prisma.account.create({
      data
    });
    return account;
  }
  async findByName(name) {
    const account = await prisma.account.findFirst({
      where: {
        name
      }
    });
    return account;
  }
  async findById(id) {
    const account = await prisma.account.findUnique({
      where: {
        id
      }
    });
    return account;
  }
  async changeBalance(id, value, operationType, tx) {
    const client = tx ?? prisma;
    try {
      await client.account.update({
        where: { id },
        data: {
          balance: {
            increment: operationType ? value : -value
          }
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  async update(id, data) {
    const updatedAccount = await prisma.account.update({
      where: { id },
      data
    });
    return updatedAccount;
  }
  async delete(id) {
    await prisma.account.delete({
      where: { id }
    });
  }
};

// src/use-cases/errors/only-natural-numbers-error.ts
var OnlyNaturalNumbersError = class extends Error {
  constructor() {
    super("Apenas numeros naturais");
  }
};

// src/use-cases/account.ts
var AccountUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({
    name,
    description,
    goal,
    balance
  }) {
    const accountWithSameName = await this.accountsRepository.findByName(name);
    if (accountWithSameName !== null) {
      throw new ThisNameAlreadyExistsError();
    }
    if (balance < 0) {
      throw new OnlyNaturalNumbersError();
    }
    const account = await this.accountsRepository.create({
      name,
      description,
      goal,
      balance
    });
    return {
      account
    };
  }
};

// src/use-cases/factories/make-account-use-case.ts
function MakeAccountUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const accountUseCase = new AccountUseCase(accountsRepository);
  return accountUseCase;
}

// src/http/controllers/financial/account.ts
var import_zod6 = require("zod");
async function createAccount(request, reply) {
  const registerBodySchema = import_zod6.z.object({
    name: import_zod6.z.string(),
    balance: import_zod6.z.number(),
    description: import_zod6.z.string().nullish(),
    goal: import_zod6.z.number().nullish()
  });
  const { name, description, balance, goal } = registerBodySchema.parse(request.body);
  let account;
  try {
    const accountUseCase = MakeAccountUseCase();
    account = await accountUseCase.execute({
      name,
      description: description || null,
      balance,
      goal: goal || null
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(account);
}

// src/use-cases/get-accounts.ts
var GetAccountsUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute() {
    const accounts = await this.accountsRepository.findMany();
    return {
      accounts
    };
  }
};

// src/use-cases/factories/make-get-accounts-use-case.ts
function MakeGetAccountsUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const getAccountUseCase = new GetAccountsUseCase(accountsRepository);
  return getAccountUseCase;
}

// src/http/controllers/financial/getAccount.ts
async function getAccount(request, reply) {
  let accounts;
  try {
    const getAccountUseCase = MakeGetAccountsUseCase();
    accounts = await getAccountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(accounts);
}

// src/http/controllers/financial/transaction.ts
var import_zod7 = require("zod");

// src/repositories/prisma/prisma-transactions-repository.ts
var PrismaTransactionsRepository = class {
  // Versão otimizada com Promise.all (mais rápida)
  async getFinancialSummary() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const startOfToday = new Date(currentDate);
    startOfToday.setHours(0, 0, 0, 0);
    const [
      totalBalance,
      monthlyIncomeResult,
      monthlyExpensesResult,
      pendingIncomeResult,
      pendingExpensesResult,
      overdueIncomeResult,
      overdueExpensesResult
    ] = await Promise.all([
      this.getBalance(),
      // Entradas totais do mês
      prisma.transaction.aggregate({
        where: {
          operation: "income",
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // Saídas totais do mês
      prisma.transaction.aggregate({
        where: {
          operation: "expense",
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // A receber do mês (pendentes)
      prisma.transaction.aggregate({
        where: {
          operation: "income",
          confirmed: false,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // A pagar do mês (pendentes)
      prisma.transaction.aggregate({
        where: {
          operation: "expense",
          confirmed: false,
          date: { gte: startOfMonth, lt: startOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // 🔥 CORREÇÃO: A receber vencido (usando startOfToday)
      prisma.transaction.aggregate({
        where: {
          operation: "income",
          confirmed: false,
          date: { lt: startOfToday }
          // Data menor que HOJE 00:00 = vencido
        },
        _sum: { amount: true }
      }),
      // 🔥 CORREÇÃO: A pagar vencido (usando startOfToday)
      prisma.transaction.aggregate({
        where: {
          operation: "expense",
          confirmed: false,
          date: { lt: startOfToday }
          // Data menor que HOJE 00:00 = vencido
        },
        _sum: { amount: true }
      })
    ]);
    return {
      totalBalance,
      monthlyIncome: monthlyIncomeResult._sum.amount || 0,
      monthlyExpenses: monthlyExpensesResult._sum.amount || 0,
      pendingIncome: pendingIncomeResult._sum.amount || 0,
      pendingExpenses: pendingExpensesResult._sum.amount || 0,
      overdueIncome: overdueIncomeResult._sum.amount || 0,
      // A receber vencido
      overdueExpenses: overdueExpensesResult._sum.amount || 0
      // A pagar vencido
    };
  }
  async getBalance() {
    const balanceResult = await prisma.account.aggregate({
      _sum: {
        balance: true
      }
    });
    return Number(balanceResult._sum.balance) || 0;
  }
  async getMonthIncomeByDays() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const dailyIncomes = await prisma.transaction.groupBy({
      by: ["date"],
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "income"
          }
        ]
      },
      orderBy: {
        date: "asc"
      }
    });
    return dailyIncomes.map((income) => ({
      day: income.date.toISOString().substring(5, 10),
      revenue: income._sum.amount || 0
      // Garante que não seja null
    }));
  }
  async getMonthExpenseBySector() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const sectorExpenses = await prisma.transaction.groupBy({
      by: ["sector_id"],
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const sectorIds = sectorExpenses.map((expense) => expense.sector_id);
    const validSectorIds = sectorIds.filter((id) => id !== null);
    const sectors = await Promise.all(
      validSectorIds.map((id) => prisma.sector.findFirst({ where: { id } }))
    );
    return sectorExpenses.map((expense) => {
      if (expense.sector_id === null) {
        return {
          sector_name: "Sem setor",
          amount: Number((expense._sum.amount || 0).toFixed(2))
        };
      }
      const sectorIndex = validSectorIds.indexOf(expense.sector_id);
      const sectorName = sectorIndex !== -1 ? sectors[sectorIndex]?.name : "Setor n\xE3o encontrado";
      return {
        sector_name: sectorName || "Setor n\xE3o encontrado",
        amount: Number((expense._sum.amount || 0).toFixed(2))
      };
    });
  }
  async getMonthExpenseAmount() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const thisMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            confirmed: true
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const thisMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const lastMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1 - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber - 1, 1)
            }
          },
          {
            operation: "expense"
          }
        ]
      }
    });
    const thisMonthAmount = thisMonthTransactionsAmount._sum.amount || 0;
    const lastMonthAmount = lastMonthTransactionsAmount._sum.amount || 0;
    const alreadyPaid = thisMonthTransactionsPaidAmount._sum.amount || 0;
    let diffFromLastMonth = 0;
    if (lastMonthAmount > 0) {
      diffFromLastMonth = Number(((thisMonthAmount - lastMonthAmount) / lastMonthAmount * 100).toFixed(2));
    } else if (thisMonthAmount > 0) {
      diffFromLastMonth = 100;
    }
    return {
      monthExpenseAmount: thisMonthAmount,
      alreadyPaid,
      diffFromLastMonth
    };
  }
  async getMonthIncomeAmount() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const thisMonthTransactionsPaidAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            confirmed: true
          },
          {
            operation: "income"
          }
        ]
      }
    });
    const thisMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
            }
          },
          {
            operation: "income"
          }
        ]
      }
    });
    const lastMonthTransactionsAmount = await prisma.transaction.aggregate({
      _sum: {
        amount: true
      },
      where: {
        AND: [
          {
            date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1 - 1, 1),
              lt: new Date(thisMonthYear, thisMonthNumber - 1, 1)
            }
          },
          {
            operation: "income"
          }
        ]
      }
    });
    const thisMonthAmount = thisMonthTransactionsAmount._sum.amount || 0;
    const lastMonthAmount = lastMonthTransactionsAmount._sum.amount || 0;
    const alreadyPaid = thisMonthTransactionsPaidAmount._sum.amount || 0;
    let diffFromLastMonth = 0;
    if (lastMonthAmount > 0) {
      diffFromLastMonth = Number(((thisMonthAmount - lastMonthAmount) / lastMonthAmount * 100).toFixed(2));
    } else if (thisMonthAmount > 0) {
      diffFromLastMonth = 100;
    }
    return {
      monthIncomeAmount: thisMonthAmount,
      alreadyPaid,
      diffFromLastMonth
    };
  }
  async delete(id) {
    const findedTransaction = await prisma.transaction.findFirst({ where: { id } });
    if (findedTransaction) {
      await prisma.transaction.delete({
        where: { id }
      });
    }
  }
  async changeTransactionStatus(data) {
    const { id, amount: newAmount, date, account_id } = data;
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id }
    });
    if (!existingTransaction) {
      throw new ResourceNotFoundError();
    }
    if (existingTransaction.confirmed) {
      return;
    }
    let accountBalanceChange = 0;
    if (existingTransaction.operation === "income") {
      accountBalanceChange = newAmount;
    } else if (existingTransaction.operation === "expense") {
      accountBalanceChange = -newAmount;
    }
    const targetAccountId = account_id || existingTransaction.account_id;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id },
          data: {
            amount: newAmount,
            // Novo valor (pago parcial ou total)
            date,
            // Nova data de liquidação (data de liquidação efetiva)
            confirmed: true,
            // Hardcoded: a função é para liquidar/confirmar
            account_id: targetAccountId
            // Atualiza a conta se mudou
          }
        });
        await tx.account.update({
          where: { id: targetAccountId },
          data: {
            balance: {
              // Adiciona/Remove o valor liquidado do saldo existente
              increment: accountBalanceChange
            }
          }
        });
      });
    } catch (error) {
      console.error("Erro na transa\xE7\xE3o de liquida\xE7\xE3o:", error);
      throw new Error("Falha ao liquidar a transa\xE7\xE3o e atualizar o saldo da conta.");
    }
  }
  async update(data) {
    if (!data.id) {
      throw new Error("Transaction ID is required for update");
    }
    const updateData = {
      operation: data.operation,
      date: data.date,
      amount: data.amount,
      description: data.description,
      confirmed: data.confirmed
    };
    if (data.account_id !== void 0) {
      updateData.account_id = data.account_id;
    }
    if (data.sector_id !== void 0) {
      updateData.sector_id = data.sector_id;
    }
    const updatedTransaction = await prisma.transaction.update({
      where: {
        id: data.id
      },
      data: updateData
    });
    return {
      id: updatedTransaction.id,
      operation: updatedTransaction.operation,
      date: updatedTransaction.date,
      amount: updatedTransaction.amount,
      account_id: updatedTransaction.account_id,
      sector_id: updatedTransaction.sector_id,
      description: updatedTransaction.description,
      confirmed: updatedTransaction.confirmed,
      created_at: updatedTransaction.created_at
    };
  }
  async findMany(month, pageIndex, perPage, description, value, sector_id, account_id, status, toDate) {
    if (!pageIndex)
      pageIndex = 1;
    let take = 6;
    if (perPage)
      take = perPage;
    let skip = 0;
    if (pageIndex >= 1) {
      skip = pageIndex * take - take;
    }
    let sector;
    if (sector_id === "all") {
      sector = void 0;
    } else {
      sector = sector_id;
    }
    let account;
    if (account_id === "all") {
      account = void 0;
    } else {
      account = account_id;
    }
    let confirmedFilter = void 0;
    if (status === "pending") {
      confirmedFilter = false;
    } else if (status === "completed") {
      confirmedFilter = true;
    }
    const year = month.getFullYear();
    const monthNumber = month.getMonth() + 1;
    let dateFilter;
    if (status === "pending") {
      const targetDate = toDate || new Date((/* @__PURE__ */ new Date()).setDate((/* @__PURE__ */ new Date()).getDate() + 7));
      targetDate.setHours(23, 59, 59, 999);
      dateFilter = {
        lte: targetDate
      };
    } else {
      dateFilter = {
        gte: new Date(year, monthNumber - 1, 1),
        // Start of month
        lt: new Date(year, monthNumber, 1)
        // End of month (excluding the last day)
      };
    }
    const whereConditions = {
      AND: [
        {
          date: dateFilter
          // Use dynamic date filter
        },
        {
          sectors: {
            id: { equals: sector }
          }
        },
        {
          accounts: {
            id: { equals: account }
          }
        },
        {
          description: {
            contains: description,
            mode: "insensitive"
          }
        },
        {
          amount: {
            equals: value
          }
        },
        // Add confirmed filter if status is provided
        ...confirmedFilter !== void 0 ? [{ confirmed: confirmedFilter }] : []
      ]
    };
    const totalCount = await prisma.transaction.count({
      where: whereConditions
    });
    const transactions = await prisma.transaction.findMany({
      skip,
      take,
      where: whereConditions,
      orderBy: [
        {
          date: "asc"
        }
      ],
      include: {
        accounts: true,
        sectors: true
      }
    });
    return {
      transactions,
      totalCount,
      perPage: take,
      pageIndex
    };
  }
  async findById(id) {
    const transaction = prisma.transaction.findFirst({
      where: {
        id
      }
    });
    return transaction;
  }
  async create(data, tx) {
    if (!data.date) {
      data.date = /* @__PURE__ */ new Date();
    }
    if (!data.confirmed) {
      data.confirmed = false;
    }
    const createTransaction2 = {
      ...data,
      account_id: void 0,
      sector_id: void 0
    };
    const client = tx ?? prisma;
    let transaction;
    if (!data.sector_id) {
      transaction = await client.transaction.create({
        data: {
          ...createTransaction2,
          accounts: {
            connect: { id: data.account_id }
          }
        }
      });
    } else {
      transaction = await client.transaction.create({
        data: {
          ...createTransaction2,
          accounts: {
            connect: { id: data.account_id }
          },
          sectors: {
            connect: { id: data.sector_id }
          }
        }
      });
    }
    return transaction;
  }
};

// src/use-cases/transaction.ts
var TransactionUseCase = class {
  constructor(transactionsRepository, transferTransactionsRepository, accountsRepository) {
    this.transactionsRepository = transactionsRepository;
    this.transferTransactionsRepository = transferTransactionsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    operation,
    amount,
    account_id,
    date,
    sector_id,
    description,
    confirmed,
    destination_account_id
  }) {
    if (operation !== "income" && operation !== "expense" && operation !== "transfer") {
      throw new ResourceNotFoundError();
    }
    let account;
    if (account_id)
      account = await this.accountsRepository.findById(account_id);
    if (!account)
      throw new ResourceNotFoundError();
    const isIncome = operation === "income" ? true : false;
    if (confirmed === true || operation === "transfer") {
      await this.accountsRepository.changeBalance(account_id, amount, isIncome);
    }
    const transaction = await this.transactionsRepository.create({
      operation,
      amount,
      account_id,
      date: date ? date : /* @__PURE__ */ new Date(),
      sector_id,
      description,
      confirmed: operation === "transfer" ? true : confirmed ? confirmed : false
    });
    if (operation === "transfer" && destination_account_id) {
      await this.transferTransactionsRepository.create({
        destination_account_id,
        transaction_id: transaction.id
      });
      console.log("change balance");
      await this.accountsRepository.changeBalance(destination_account_id, amount, !isIncome);
    }
    return {
      transaction
    };
  }
};

// src/repositories/prisma/prisma-transfer-transactions-repository.ts
var PrismaTransferTransactionsRepository = class {
  async findByAccount(account_id) {
    const transferTransaction = prisma.transferTransaction.findMany({
      where: {
        destination_account_id: account_id
      }
    });
    return transferTransaction;
  }
  async create(data) {
    const transaction = prisma.transferTransaction.create({
      data
    });
    return transaction;
  }
  async findMany() {
    const transferTransactions = await prisma.transferTransaction.findMany({
      include: {
        transaction: {
          include: {
            accounts: true
          }
        },
        accounts: true
      },
      orderBy: {
        transaction: {
          date: "desc"
        }
      }
    });
    return transferTransactions;
  }
};

// src/use-cases/factories/make-transaction-use-case.ts
function MakeTransactionUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const transferTransactionsRepository = new PrismaTransferTransactionsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const useCase = new TransactionUseCase(transactionsRepository, transferTransactionsRepository, accountsRepository);
  return useCase;
}

// src/http/controllers/financial/transaction.ts
async function createTransaction(request, reply) {
  const registerBodySchema = import_zod7.z.object({
    operation: import_zod7.z.string(),
    amount: import_zod7.z.number(),
    account_id: import_zod7.z.string(),
    date: import_zod7.z.coerce.date().nullish(),
    sector_id: import_zod7.z.string().nullish(),
    description: import_zod7.z.string().nullish(),
    confirmed: import_zod7.z.boolean().nullish(),
    destination_account_id: import_zod7.z.string().nullish()
  });
  console.log(request.body);
  const { operation, amount, account_id, date, sector_id, description, confirmed, destination_account_id } = registerBodySchema.parse(request.body);
  console.log("aqui");
  let transaction;
  try {
    const transactionUseCase = MakeTransactionUseCase();
    transaction = await transactionUseCase.execute({
      operation,
      amount,
      account_id,
      confirmed: confirmed || null,
      date: date || null,
      sector_id: sector_id || null,
      description: description || null,
      destination_account_id: destination_account_id || null
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(transaction);
}

// src/use-cases/get-transactions.ts
var GetTransactionsUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute({ pageIndex, perPage, description, value, sector_id, account_id, month, status, toDate }) {
    console.log("USE CASE ACCOUNT" + account_id);
    if (!perPage)
      perPage = 6;
    const transactions = await this.transactionsRepository.findMany(month, pageIndex, perPage, description, value, sector_id, account_id, status, toDate);
    return transactions;
  }
};

// src/use-cases/factories/make-get-transactions-use-case.ts
function MakeGetTransactionsUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getTransactionUseCase = new GetTransactionsUseCase(transactionsRepository);
  return getTransactionUseCase;
}

// src/http/controllers/financial/getTransactions.ts
var import_zod8 = require("zod");
async function getTransactions(request, reply) {
  const getTransactionsParamsSchema = import_zod8.z.object({
    page: import_zod8.z.string(),
    description: import_zod8.z.string().nullish(),
    value: import_zod8.z.string().nullish(),
    sector_id: import_zod8.z.string().nullish(),
    account_id: import_zod8.z.string().nullish(),
    month: import_zod8.z.date().nullish(),
    status: import_zod8.z.string().nullish(),
    toDate: import_zod8.z.string().nullish()
  });
  const { page, description, value, sector_id, account_id, month, status, toDate } = getTransactionsParamsSchema.parse(request.query);
  let transactions;
  console.log("Descri\xE7\xE3o: " + description);
  console.log("Valor: " + value);
  console.log("Setor: " + sector_id);
  console.log("Account*************: " + account_id);
  try {
    const getTransactionUseCase = MakeGetTransactionsUseCase();
    transactions = await getTransactionUseCase.execute({
      pageIndex: parseInt(page),
      description: description ? description : void 0,
      value: value ? Number(value) : void 0,
      month: month ? month : /* @__PURE__ */ new Date(),
      sector_id: sector_id ? sector_id : "all",
      account_id: account_id ? account_id : "all",
      status: status || void 0,
      toDate: toDate ? new Date(toDate) : void 0
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send({ transactions });
}

// src/use-cases/get-transfer-transactions.ts
var GetTransferTransactionsUseCase = class {
  constructor(transferTransactionsRepository) {
    this.transferTransactionsRepository = transferTransactionsRepository;
  }
  async execute() {
    const transferTransactions = await this.transferTransactionsRepository.findMany();
    return { transferTransactions };
  }
};

// src/use-cases/factories/make-get-transfer-transactions-use-case.ts
function MakeGetTransferTransactionsUseCase() {
  const transferTransactionsRepository = new PrismaTransferTransactionsRepository();
  const getTransferTransactionUseCase = new GetTransferTransactionsUseCase(transferTransactionsRepository);
  return getTransferTransactionUseCase;
}

// src/http/controllers/financial/getTransferTransaction.ts
async function getTransferTransaction(request, reply) {
  let transactions;
  try {
    const getTransferTransactionUseCase = MakeGetTransferTransactionsUseCase();
    transactions = await getTransferTransactionUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(transactions);
}

// src/repositories/prisma/prisma-payments-repository.ts
var PrismaPaymentsRepository = class {
  async create(data) {
    const payment = await prisma.payment.create({
      data
    });
    return payment;
  }
  async update(id, data) {
    const payment = await prisma.payment.update({
      where: { id },
      data
    });
    return payment;
  }
  async delete(id) {
    await prisma.payment.delete({
      where: { id }
    });
  }
  async findById(id) {
    const payment = await prisma.payment.findFirst({
      where: {
        id
      }
    });
    return payment;
  }
  async findMany() {
    const payments = await prisma.payment.findMany({
      include: {
        accounts: true
      }
    });
    return payments;
  }
  async findByName(name) {
    const payments = await prisma.payment.findFirst({ where: { name } });
    return payments;
  }
};

// src/use-cases/payment.ts
var PaymentUseCase = class {
  constructor(paymentsRepository, accountsRepository) {
    this.paymentsRepository = paymentsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    name,
    installment_limit,
    in_sight,
    account_id
  }) {
    const sameNamePayment = await this.paymentsRepository.findByName(name);
    if (sameNamePayment)
      throw new ThisNameAlreadyExistsError();
    if (installment_limit <= 0)
      throw new OnlyNaturalNumbersError();
    let findedAccount;
    if (account_id)
      findedAccount = await this.accountsRepository.findById(account_id);
    if (!findedAccount)
      throw new ResourceNotFoundError();
    const payment = await this.paymentsRepository.create({
      name,
      installment_limit,
      in_sight,
      account_id
    });
    return {
      payment
    };
  }
};

// src/use-cases/factories/make-payment-use-case.ts
function MakePaymentUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const paymentUseCase = new PaymentUseCase(paymentsRepository, accountsRepository);
  return paymentUseCase;
}

// src/http/controllers/financial/payment.ts
var import_zod9 = require("zod");
async function createPayment(request, reply) {
  const registerBodySchema = import_zod9.z.object({
    name: import_zod9.z.string(),
    installment_limit: import_zod9.z.number(),
    in_sight: import_zod9.z.boolean(),
    account_id: import_zod9.z.string()
  });
  const { name, installment_limit, in_sight, account_id } = registerBodySchema.parse(request.body);
  let payment;
  try {
    const paymentUseCase = MakePaymentUseCase();
    payment = await paymentUseCase.execute({
      name,
      installment_limit,
      in_sight,
      account_id
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(payment);
}

// src/repositories/prisma/prisma-payment-entrys-repository.ts
var PrismaPaymentEntrysRepository = class {
  update(data) {
    throw new Error("Method not implemented.");
  }
  async findById(id) {
    const paymentEntry = await prisma.paymentEntry.findUnique({ where: { id } });
    return paymentEntry;
  }
  async findMany() {
    const paymentEntry = prisma.paymentEntry.findMany();
    return paymentEntry;
  }
  async findByTreatmentId(treatment_id) {
    const paymentEntries = await prisma.paymentEntry.findMany({
      where: {
        treatment_id
      },
      include: {
        payments: true
      }
    });
    return paymentEntries;
  }
  async create(data) {
    const paymentEntry = await prisma.paymentEntry.create({
      data
    });
    return paymentEntry;
  }
};

// src/use-cases/paymentEntry.ts
var PaymentEntryUseCase = class {
  constructor(paymentEntrysRepository, paymentRepository, treatmentRepository) {
    this.paymentEntrysRepository = paymentEntrysRepository;
    this.paymentRepository = paymentRepository;
    this.treatmentRepository = treatmentRepository;
  }
  async execute({
    payment_id,
    treatment_id,
    occurrences,
    amount
  }) {
    const payment = await this.paymentRepository.findById(payment_id);
    if (!payment)
      throw new ResourceNotFoundError();
    const treatment = await this.treatmentRepository.findById(treatment_id);
    if (!treatment)
      throw new ResourceNotFoundError();
    if (occurrences <= 0 || amount <= 0)
      throw new OnlyNaturalNumbersError();
    const paymentEntry = await this.paymentEntrysRepository.create({
      payment_id,
      treatment_id,
      occurrences,
      amount
    });
    return {
      paymentEntry
    };
  }
};

// src/repositories/prisma/prisma-treatments-repository.ts
var PrismaTreatmentsRepository = class {
  async getMonthTreatmentsAmount() {
    const month = /* @__PURE__ */ new Date();
    const thisMonthYear = month.getFullYear();
    const thisMonthNumber = month.getMonth() + 1;
    const thisMonthTreatmentsAmount = await prisma.treatment.count({
      where: {
        AND: [
          {
            opening_date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1, 1),
              // Start of month
              lt: new Date(thisMonthYear, thisMonthNumber, 1)
              // End of month (excluding the last day)
            }
          }
        ]
      }
    });
    const lastMonthTreatmentsAmount = await prisma.treatment.count({
      where: {
        AND: [
          {
            opening_date: {
              gte: new Date(thisMonthYear, thisMonthNumber - 1 - 1, 1),
              // Start of month
              lt: new Date(thisMonthYear, thisMonthNumber - 1, 1)
              // End of month (excluding the last day)
            }
          }
        ]
      }
    });
    const diffFromMonths = lastMonthTreatmentsAmount && thisMonthTreatmentsAmount ? thisMonthTreatmentsAmount * 100 / lastMonthTreatmentsAmount : null;
    return {
      amount: thisMonthTreatmentsAmount,
      diffFromLastMonth: diffFromMonths ? Number((diffFromMonths - 100).toFixed(2)) : 0
    };
  }
  async findByActive(pageIndex, perPage, treatmentId, clientName, status) {
    if (!pageIndex) pageIndex = 1;
    let take = 6;
    if (perPage) take = perPage;
    let skip = 0;
    if (pageIndex >= 1) {
      skip = pageIndex * take - take;
    }
    const whereConditions = {};
    if (treatmentId) {
      whereConditions.id = { contains: treatmentId };
    }
    if (clientName) {
      whereConditions.clients = {
        name: {
          contains: clientName,
          mode: "insensitive"
        }
      };
    }
    if (status && status !== "all") {
      whereConditions.status = { equals: status };
    } else if (!status || status === "all") {
      whereConditions.OR = [
        { status: { equals: "pending" } },
        { status: { equals: "in_progress" } },
        { status: { equals: "on_hold" } },
        { status: { equals: "follow_up" } },
        { status: { equals: "in_workbench" } },
        { status: { equals: "resolved" } },
        { status: { equals: "canceled" } }
      ];
    }
    const totalCount = await prisma.treatment.count({
      where: whereConditions
    });
    const treatmentsRaw = await prisma.treatment.findMany({
      skip,
      take,
      where: whereConditions,
      orderBy: [
        {
          opening_date: "asc"
        }
      ],
      include: {
        clients: true,
        items: {
          select: {
            quantity: true,
            salesValue: true,
            discount: true
          }
        }
      }
    });
    const treatments = treatmentsRaw.map((t) => {
      const amount = t.items.reduce((acc, item) => {
        const qty = item.quantity || 0;
        const val = item.salesValue || 0;
        const disc = item.discount || 0;
        return acc + (qty * val - disc);
      }, 0);
      return {
        ...t,
        amount: Number(amount.toFixed(2))
      };
    });
    return {
      treatments,
      // Cast to match DTO if necessary
      totalCount,
      perPage: take,
      pageIndex
    };
  }
  async create(data) {
    const treatment = await prisma.treatment.create({
      data
    });
    return treatment;
  }
  async findById(id) {
    const treatment = await prisma.treatment.findFirst({
      where: {
        id
      },
      include: {
        clients: true,
        equipments: true,
        items: {
          include: {
            items: true
          }
        },
        interactions: true
      }
    });
    if (!treatment) return null;
    const amount = treatment.items.reduce((acc, item) => {
      const qty = item.quantity || 0;
      const val = item.salesValue || 0;
      const disc = item.discount || 0;
      return acc + (qty * val - disc);
    }, 0);
    return {
      ...treatment,
      amount: Number(amount.toFixed(2))
    };
  }
  async update(id, data) {
    const updatedTreatment = await prisma.treatment.update({
      where: { id },
      data
    });
    return updatedTreatment;
  }
  async findByClient(client_id) {
    const treatments = await prisma.treatment.findMany({
      where: {
        client_id
      }
    });
    return treatments;
  }
  async findByStatus(status) {
    const treatments = prisma.treatment.findMany({
      where: {
        status
      },
      include: {
        users: true,
        equipments: true,
        items: true
      }
    });
    return treatments;
  }
  async close(id, tx) {
    const client = tx ?? prisma;
    const treatment = await client.treatment.update({
      where: { id },
      data: {
        ending_date: /* @__PURE__ */ new Date(),
        status: "resolved"
      }
    });
    return treatment;
  }
};

// src/use-cases/factories/make-payment-entry-use-case.ts
function MakePaymentEntryUseCase() {
  const paymentEntrysRepository = new PrismaPaymentEntrysRepository();
  const paymentsRepository = new PrismaPaymentsRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const paymentEntryUseCase = new PaymentEntryUseCase(paymentEntrysRepository, paymentsRepository, treatmentsRepository);
  return paymentEntryUseCase;
}

// src/http/controllers/financial/paymentEntry.ts
var import_zod10 = require("zod");
async function createPaymentEntry(request, reply) {
  const registerBodySchema = import_zod10.z.object({
    treatment_id: import_zod10.z.string(),
    payment_id: import_zod10.z.string(),
    amount: import_zod10.z.number(),
    occurrences: import_zod10.z.number()
  });
  const { treatment_id, payment_id, amount, occurrences } = registerBodySchema.parse(request.body);
  let paymentEntry;
  try {
    const paymentEntryUseCase = MakePaymentEntryUseCase();
    paymentEntry = await paymentEntryUseCase.execute({
      treatment_id,
      payment_id,
      amount,
      occurrences
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(paymentEntry);
}

// src/http/middlewares/verify-user-role.ts
function verifyUserRole(roleToVerify) {
  return async (request, reply) => {
    const { role } = request.user;
    if (role !== roleToVerify) {
      return reply.status(401).send({ message: "Usu\xE1rio esta desautorizado para esta fun\xE7\xE3o" });
    }
  };
}

// src/use-cases/errors/transaction-already-confirmed-error.ts
var TransactionAlreadyConfirmedError = class extends Error {
  constructor() {
    super("Transaction is already confirmed and cannot be changed.");
    this.name = "TransactionAlreadyConfirmedError";
  }
};

// src/use-cases/change-transaction-status.ts
function getCleanRemainingDescription(originalTransaction) {
  const originalDescription = originalTransaction.description || "";
  let baseDescription = originalDescription.trim();
  let currentLevel = 0;
  const numberedPrefixRegex = /^PR\s*\((\d+)\):/i;
  const numberedMatch = baseDescription.match(numberedPrefixRegex);
  if (numberedMatch) {
    currentLevel = parseInt(numberedMatch[1], 10);
    baseDescription = baseDescription.substring(numberedMatch[0].length).trim();
  } else {
    const genericPrefixes = [
      "PR: ",
      "RES: ",
      "PARCELA RESTANTE: "
    ];
    for (const prefix of genericPrefixes) {
      if (baseDescription.startsWith(prefix)) {
        currentLevel = 1;
        baseDescription = baseDescription.substring(prefix.length).trim();
        break;
      }
    }
  }
  const newLevel = currentLevel + 1;
  if (baseDescription === "") {
    baseDescription = "Sem Descri\xE7\xE3o Original";
  }
  return `PR (${newLevel}): ${baseDescription}`;
}
var ChangeTransactionUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute({
    id,
    amount: amountPaid,
    date,
    remainingDate,
    account_id
    // Recebe a conta
  }) {
    const originalTransaction = await this.transactionsRepository.findById(id);
    if (!originalTransaction) {
      throw new ResourceNotFoundError();
    }
    if (originalTransaction.confirmed) {
      throw new TransactionAlreadyConfirmedError();
    }
    if (amountPaid <= 0) {
      throw new Error("O valor de liquida\xE7\xE3o (amount) deve ser positivo.");
    }
    if (amountPaid > originalTransaction.amount) {
      throw new Error(`O valor pago (${amountPaid}) n\xE3o pode ser maior que o valor da transa\xE7\xE3o original (${originalTransaction.amount}).`);
    }
    const remainingAmount = originalTransaction.amount - amountPaid;
    if (remainingAmount > 0) {
      const newDueDate = remainingDate || originalTransaction.date;
      const newDescription = getCleanRemainingDescription(originalTransaction);
      const remainingTransactionData = {
        operation: originalTransaction.operation,
        account_id: originalTransaction.account_id,
        // Mantém na conta original
        sector_id: originalTransaction.sector_id,
        amount: remainingAmount,
        confirmed: false,
        date: newDueDate,
        description: newDescription
        // <-- DESCRIÇÃO NUMERADA
      };
      await this.transactionsRepository.create(remainingTransactionData);
    }
    await this.transactionsRepository.changeTransactionStatus({
      id,
      amount: amountPaid,
      date,
      account_id
      // Passa a nova conta para a repository atualizar antes de confirmar
    });
  }
};

// src/use-cases/factories/make-change-transaction-status.ts
function MakeChangeTransactionStatusUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const changeTransactionUseCase = new ChangeTransactionUseCase(
    transactionsRepository
  );
  return changeTransactionUseCase;
}

// src/http/controllers/financial/changeTransactionPayment.ts
var import_zod11 = require("zod");
async function changeTransactionStatus(request, reply) {
  const switchTransactionParamsSchema = import_zod11.z.object({
    id: import_zod11.z.string().uuid()
  });
  const switchTransactionBodySchema = import_zod11.z.object({
    amount: import_zod11.z.number().positive(),
    date: import_zod11.z.string().or(import_zod11.z.date()).transform((val) => new Date(val)),
    // Data de liquidação
    // NOVO: remainingDate é opcional e deve ser uma data
    remainingDate: import_zod11.z.string().or(import_zod11.z.date()).transform((val) => new Date(val)).optional(),
    // NOVO: Permitir trocar a conta na hora do pagamento
    account_id: import_zod11.z.string().uuid().optional()
  });
  const { id } = switchTransactionParamsSchema.parse(request.params);
  const { amount, date, remainingDate, account_id } = switchTransactionBodySchema.parse(
    request.body
  );
  console.log({ amount, date, remainingDate, account_id });
  try {
    const changeTransactionStatusUseCase = MakeChangeTransactionStatusUseCase();
    await changeTransactionStatusUseCase.execute({
      id,
      amount,
      // Valor pago (parcial ou total)
      date,
      // Data de confirmação/pagamento
      remainingDate,
      // Passa a nova data de vencimento da parcela restante (opcional)
      account_id
      // Conta selecionada (opcional)
    });
    return reply.status(200).send();
  } catch (err) {
    if (err instanceof import_zod11.z.ZodError) {
      return reply.status(400).send({ message: "Validation error.", issues: err.format() });
    }
    if (err instanceof Error) {
      if (err.message.includes("Resource not found")) {
        return reply.status(404).send({ message: "Transaction not found." });
      }
      return reply.status(400).send({ message: err.message });
    }
    console.error(err);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

// src/use-cases/delete-transaction.ts
var DeleteTransactionUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute({
    id
  }) {
    const transaction = await this.transactionsRepository.findById(id);
    if (!transaction) {
      throw new ResourceNotFoundError();
    }
    if (transaction.confirmed) {
      throw new TransactionAlreadyConfirmedError();
    }
    await this.transactionsRepository.delete(id);
  }
};

// src/use-cases/factories/make-delete-transaction.ts
function MakeDeleteTransactionUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const treatmentItemUseCase = new DeleteTransactionUseCase(
    transactionsRepository
  );
  return treatmentItemUseCase;
}

// src/http/controllers/financial/deleteTransaction.ts
var import_zod12 = require("zod");
async function deleteTransaction(request, reply) {
  const deleteItemTreatmentParamsSchema = import_zod12.z.object({
    id: import_zod12.z.string().uuid()
  });
  const { id } = deleteItemTreatmentParamsSchema.parse(request.params);
  console.log(id);
  try {
    const deleteTransactionUseCase = MakeDeleteTransactionUseCase();
    await deleteTransactionUseCase.execute({
      id
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/use-cases/get-payments.ts
var GetPaymentsUseCase = class {
  constructor(paymentsRepository) {
    this.paymentsRepository = paymentsRepository;
  }
  async execute() {
    const payments = await this.paymentsRepository.findMany();
    return payments;
  }
};

// src/use-cases/factories/make-get-payments-use-case.ts
function MakeGetPaymentsUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const getPaymentsUseCase = new GetPaymentsUseCase(paymentsRepository);
  return getPaymentsUseCase;
}

// src/http/controllers/financial/getPayments.ts
async function getPayments(request, reply) {
  let payments;
  try {
    const getPaymentsUseCase = MakeGetPaymentsUseCase();
    payments = await getPaymentsUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(payments);
}

// src/use-cases/get-financial-summary.ts
var GetFinancialSummaryUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const summary = await this.transactionsRepository.getFinancialSummary();
    return { summary };
  }
};

// src/use-cases/factories/make-get-financial-summary.ts
function MakeGetFinancialSummaryUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getFinancialSummaryUseCase = new GetFinancialSummaryUseCase(transactionsRepository);
  return getFinancialSummaryUseCase;
}

// src/http/controllers/financial/get-financial-summary.ts
async function getFinancialSummary(request, reply) {
  let financialSummary;
  try {
    const getFinancialSummaryUseCase = MakeGetFinancialSummaryUseCase();
    financialSummary = await getFinancialSummaryUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(financialSummary);
}

// src/http/controllers/financial/updateAccount.ts
var import_zod13 = require("zod");

// src/use-cases/update-account.ts
var UpdateAccountUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({
    id,
    name,
    description,
    goal
  }) {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundError();
    }
    const updatedAccount = await this.accountsRepository.update(id, {
      name,
      description,
      goal
      // Balance is NOT updated here to ensure integrity
    });
    if (!updatedAccount) {
      throw new ResourceNotFoundError();
    }
    return {
      account: updatedAccount
    };
  }
};

// src/use-cases/factories/make-update-account-use-case.ts
function MakeUpdateAccountUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const updateAccountUseCase = new UpdateAccountUseCase(accountsRepository);
  return updateAccountUseCase;
}

// src/http/controllers/financial/updateAccount.ts
async function updateAccount(request, reply) {
  const updateAccountParamsSchema = import_zod13.z.object({
    id: import_zod13.z.string().uuid()
  });
  const updateAccountBodySchema = import_zod13.z.object({
    name: import_zod13.z.string().optional(),
    description: import_zod13.z.string().nullable().optional(),
    goal: import_zod13.z.number().nullable().optional()
  });
  const { id } = updateAccountParamsSchema.parse(request.params);
  const { name, description, goal } = updateAccountBodySchema.parse(request.body);
  try {
    const updateAccountUseCase = MakeUpdateAccountUseCase();
    await updateAccountUseCase.execute({
      id,
      name,
      description,
      goal
    });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/financial/deleteAccount.ts
var import_zod14 = require("zod");

// src/use-cases/delete-account.ts
var DeleteAccountUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({ id }) {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundError();
    }
    await this.accountsRepository.delete(id);
  }
};

// src/use-cases/factories/make-delete-account-use-case.ts
function MakeDeleteAccountUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const deleteAccountUseCase = new DeleteAccountUseCase(accountsRepository);
  return deleteAccountUseCase;
}

// src/http/controllers/financial/deleteAccount.ts
async function deleteAccount(request, reply) {
  const deleteAccountParamsSchema = import_zod14.z.object({
    id: import_zod14.z.string().uuid()
  });
  const { id } = deleteAccountParamsSchema.parse(request.params);
  try {
    const deleteAccountUseCase = MakeDeleteAccountUseCase();
    await deleteAccountUseCase.execute({ id });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/http/controllers/financial/updatePayment.ts
var import_zod15 = require("zod");

// src/use-cases/update-payment.ts
var UpdatePaymentUseCase = class {
  constructor(paymentsRepository, accountsRepository) {
    this.paymentsRepository = paymentsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    id,
    name,
    installment_limit,
    in_sight,
    account_id
  }) {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new ResourceNotFoundError();
    }
    if (account_id) {
      const account = await this.accountsRepository.findById(account_id);
      if (!account) {
        throw new ResourceNotFoundError();
      }
    }
    const updatedPayment = await this.paymentsRepository.update(id, {
      name,
      installment_limit,
      in_sight,
      account_id
    });
    return {
      payment: updatedPayment
    };
  }
};

// src/use-cases/factories/make-update-payment-use-case.ts
function MakeUpdatePaymentUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const updatePaymentUseCase = new UpdatePaymentUseCase(paymentsRepository, accountsRepository);
  return updatePaymentUseCase;
}

// src/http/controllers/financial/updatePayment.ts
async function updatePayment(request, reply) {
  const updatePaymentParamsSchema = import_zod15.z.object({
    id: import_zod15.z.string().uuid()
  });
  const updatePaymentBodySchema = import_zod15.z.object({
    name: import_zod15.z.string().optional(),
    installment_limit: import_zod15.z.number().optional(),
    in_sight: import_zod15.z.boolean().optional(),
    account_id: import_zod15.z.string().uuid().optional()
  });
  const { id } = updatePaymentParamsSchema.parse(request.params);
  const { name, installment_limit, in_sight, account_id } = updatePaymentBodySchema.parse(request.body);
  try {
    const updatePaymentUseCase = MakeUpdatePaymentUseCase();
    await updatePaymentUseCase.execute({
      id,
      name,
      installment_limit,
      in_sight,
      account_id
    });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/financial/deletePayment.ts
var import_zod16 = require("zod");

// src/use-cases/delete-payment.ts
var DeletePaymentUseCase = class {
  constructor(paymentsRepository) {
    this.paymentsRepository = paymentsRepository;
  }
  async execute({ id }) {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new ResourceNotFoundError();
    }
    await this.paymentsRepository.delete(id);
  }
};

// src/use-cases/factories/make-delete-payment-use-case.ts
function MakeDeletePaymentUseCase() {
  const paymentsRepository = new PrismaPaymentsRepository();
  const deletePaymentUseCase = new DeletePaymentUseCase(paymentsRepository);
  return deletePaymentUseCase;
}

// src/http/controllers/financial/deletePayment.ts
async function deletePayment(request, reply) {
  const deletePaymentParamsSchema = import_zod16.z.object({
    id: import_zod16.z.string().uuid()
  });
  const { id } = deletePaymentParamsSchema.parse(request.params);
  try {
    const deletePaymentUseCase = MakeDeletePaymentUseCase();
    await deletePaymentUseCase.execute({ id });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/http/controllers/financial/adjustAccountBalance.ts
var import_zod17 = require("zod");

// src/use-cases/adjust-account-balance.ts
var AdjustAccountBalanceUseCase = class {
  constructor(accountsRepository) {
    this.accountsRepository = accountsRepository;
  }
  async execute({
    id,
    newBalance
  }) {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id }
      });
      if (!account) {
        throw new ResourceNotFoundError();
      }
      const currentBalance = account.balance;
      const diff = newBalance - currentBalance;
      if (diff === 0) {
        return { account };
      }
      const amount = Math.abs(diff);
      const operation = diff > 0 ? "IN" : "OUT";
      await tx.transaction.create({
        data: {
          account_id: id,
          amount,
          operation,
          description: "Ajuste de Saldo Manual",
          confirmed: true,
          date: /* @__PURE__ */ new Date()
        }
      });
      const updatedAccount = await tx.account.update({
        where: { id },
        data: {
          balance: newBalance
        }
      });
      return { account: updatedAccount };
    });
  }
};

// src/use-cases/factories/make-adjust-account-balance-use-case.ts
function makeAdjustAccountBalanceUseCase() {
  const accountsRepository = new PrismaAccountsRepository();
  const useCase = new AdjustAccountBalanceUseCase(accountsRepository);
  return useCase;
}

// src/http/controllers/financial/adjustAccountBalance.ts
async function adjustAccountBalance(request, reply) {
  const adjustAccountBalanceBodySchema = import_zod17.z.object({
    newBalance: import_zod17.z.number()
  });
  const adjustAccountBalanceParamsSchema = import_zod17.z.object({
    id: import_zod17.z.string().uuid()
  });
  const { newBalance } = adjustAccountBalanceBodySchema.parse(request.body);
  const { id } = adjustAccountBalanceParamsSchema.parse(request.params);
  try {
    const adjustAccountBalanceUseCase = makeAdjustAccountBalanceUseCase();
    await adjustAccountBalanceUseCase.execute({
      id,
      newBalance
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send();
}

// src/http/controllers/financial/routes.ts
async function financialRoutes(app2) {
  app2.addHook("onRequest", verifyJWT);
  app2.post("/sector", { onRequest: [verifyUserRole("ADMIN")] }, createSector);
  app2.get("/sectors", getSector);
  app2.post("/account", createAccount);
  app2.get("/accounts", getAccount);
  app2.patch("/account/:id/adjust-balance", adjustAccountBalance);
  app2.put("/account/:id", updateAccount);
  app2.delete("/account/:id", deleteAccount);
  app2.post("/transaction", createTransaction);
  app2.get("/transactions", getTransactions);
  app2.delete("/transaction/:id", deleteTransaction);
  app2.get("/transfer-transactions", getTransferTransaction);
  app2.post("/payment", createPayment);
  app2.post("/payment-entry", createPaymentEntry);
  app2.patch("/switch-transaction/:id", changeTransactionStatus);
  app2.get("/payments", getPayments);
  app2.put("/payment/:id", updatePayment);
  app2.delete("/payment/:id", deletePayment);
  app2.get("/summary", getFinancialSummary);
}

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
var import_zod18 = require("zod");
async function createClient(request, reply) {
  const registerBodySchema = import_zod18.z.object({
    name: import_zod18.z.string(),
    identification: import_zod18.z.string().nullish(),
    phone: import_zod18.z.string().nullish(),
    email: import_zod18.z.string().nullish(),
    contract: import_zod18.z.boolean().nullish(),
    contact: import_zod18.z.string().nullish(),
    isEnterprise: import_zod18.z.boolean().nullish()
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
var import_zod19 = require("zod");
async function createEquipment(request, reply) {
  const registerBodySchema = import_zod19.z.object({
    client_id: import_zod19.z.string(),
    type: import_zod19.z.string(),
    brand: import_zod19.z.string().nullish(),
    identification: import_zod19.z.string().nullish(),
    details: import_zod19.z.string().nullish(),
    entry: import_zod19.z.date().nullish()
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
var import_zod20 = require("zod");
async function createAddress(request, reply) {
  const registerBodySchema = import_zod20.z.object({
    client_id: import_zod20.z.string(),
    street: import_zod20.z.string(),
    number: import_zod20.z.number(),
    neighborhood: import_zod20.z.string(),
    city: import_zod20.z.string(),
    state: import_zod20.z.string(),
    zipcode: import_zod20.z.number().nullish()
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
async function clientsRoutes(app2) {
  app2.addHook("onRequest", verifyJWT);
  app2.post("/client", createClient);
  app2.post("/equipment", createEquipment);
  app2.post("/address", createAddress);
  app2.get("/clients", getClient);
}

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

// src/use-cases/errors/price-cannot-be-lower-than-cost-error.ts
var PriceCannotBeLowerThanCost = class extends Error {
  constructor() {
    super("Custo n\xE3o pode ser menor que valor de venda");
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
var import_client4 = require("@prisma/client");
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
        operation: import_client4.StockOperation.IN
      }
    });
    const outputStocks = await prisma.stock.aggregate({
      _sum: {
        quantity: true
        // Select the quantity field for summation
      },
      where: {
        item_id,
        operation: import_client4.StockOperation.OUT
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
var import_zod21 = require("zod");
async function createItem(request, reply) {
  const registerBodySchema = import_zod21.z.object({
    name: import_zod21.z.string(),
    description: import_zod21.z.string().nullish(),
    cost: import_zod21.z.number(),
    price: import_zod21.z.number(),
    stock: import_zod21.z.number().nullish(),
    min_stock: import_zod21.z.number().nullish(),
    barcode: import_zod21.z.string().nullish(),
    category: import_zod21.z.string().nullish(),
    active: import_zod21.z.boolean().nullish(),
    isItem: import_zod21.z.boolean().nullish(),
    display_id: import_zod21.z.preprocess((val) => val === "" ? null : Number(val), import_zod21.z.number().nullable().optional())
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

// src/use-cases/errors/stock-cannot-be-negative-error.ts
var StockCannotBeNegativaError = class extends Error {
  constructor() {
    super("O Estoque do produto n\xE3o pode ser negativo");
  }
};

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

// src/use-cases/factories/make-stock-use-case.ts
function MakeStockUseCase() {
  const stocksRepository = new PrismaStocksRepository();
  const itemsRepository = new PrismaItemsRepository();
  const stockUseCase = new StockUseCase(stocksRepository, itemsRepository);
  return stockUseCase;
}

// src/http/controllers/items/stock.ts
var import_zod22 = require("zod");
async function createStock(request, reply) {
  const registerBodySchema = import_zod22.z.object({
    item_id: import_zod22.z.string(),
    quantity: import_zod22.z.coerce.number(),
    operation: import_zod22.z.string(),
    description: import_zod22.z.string().nullish(),
    created_at: import_zod22.z.coerce.date().nullish()
  });
  const { item_id, quantity, operation, description, created_at } = registerBodySchema.parse(request.body);
  let stock;
  try {
    const stockUseCase = MakeStockUseCase();
    stock = await stockUseCase.execute({
      item_id,
      description: description ? description : void 0,
      quantity,
      operation,
      created_at: created_at ? created_at : void 0
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(stock);
}

// src/http/controllers/items/getItems.ts
var import_zod23 = require("zod");

// src/use-cases/get-items.ts
var GetItemsUseCase = class {
  constructor(itemsRepository) {
    this.itemsRepository = itemsRepository;
  }
  async execute({ page, limit, is_active, is_product, name, display_id, below_min_stock }) {
    const items = await this.itemsRepository.findMany(is_active, is_product, page, limit, name, display_id, below_min_stock);
    return items;
  }
};

// src/use-cases/factories/make-get-items-use-case.ts
function MakeGetItemsUseCase() {
  const itemsRepository = new PrismaItemsRepository();
  const getItemUseCase = new GetItemsUseCase(itemsRepository);
  return getItemUseCase;
}

// src/http/controllers/items/getItems.ts
async function getItems(request, reply) {
  const getItemsQuerySchema = import_zod23.z.object({
    page: import_zod23.z.coerce.number().optional().default(1),
    limit: import_zod23.z.coerce.number().optional().default(6),
    is_active: import_zod23.z.enum(["true", "false"]).optional().transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return void 0;
    }),
    is_product: import_zod23.z.enum(["true", "false"]).optional().transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return void 0;
    }),
    name: import_zod23.z.string().optional(),
    display_id: import_zod23.z.coerce.number().optional(),
    below_min_stock: import_zod23.z.enum(["true", "false"]).optional().transform((val) => val === "true")
  });
  const { page, limit, is_active, is_product, name, display_id, below_min_stock } = getItemsQuerySchema.parse(request.query);
  try {
    const getItemUseCase = MakeGetItemsUseCase();
    const result = await getItemUseCase.execute({
      page,
      limit,
      is_active,
      is_product,
      name,
      display_id,
      below_min_stock
    });
    return reply.status(200).send(result);
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
}

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

// src/http/controllers/items/getItemHistory.ts
var import_zod24 = require("zod");
async function getItemHistory(request, reply) {
  const getItemStocksParamsSchema = import_zod24.z.object({
    id: import_zod24.z.string().uuid()
  });
  const { id } = getItemStocksParamsSchema.parse(request.params);
  let itemStocks;
  try {
    const getItemUseCase = MakeGetStocksUseCase();
    itemStocks = await getItemUseCase.execute(id);
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(itemStocks);
}

// src/http/controllers/items/updateItem.ts
var import_zod25 = require("zod");

// src/use-cases/update-item.ts
var UpdateItemUseCase = class {
  constructor(itemsRepository) {
    this.itemsRepository = itemsRepository;
  }
  async execute(data) {
    const item = await this.itemsRepository.update(data);
    return { item };
  }
};

// src/use-cases/factories/make-update-item-use-case.ts
function makeUpdateItemUseCase() {
  const itemsRepository = new PrismaItemsRepository();
  const useCase = new UpdateItemUseCase(itemsRepository);
  return useCase;
}

// src/http/controllers/items/updateItem.ts
async function updateItem(request, reply) {
  const updateItemParamsSchema = import_zod25.z.object({
    id: import_zod25.z.string().uuid()
  });
  const updateItemBodySchema = import_zod25.z.object({
    name: import_zod25.z.string().optional(),
    description: import_zod25.z.string().nullish(),
    cost: import_zod25.z.number().optional(),
    price: import_zod25.z.number().optional(),
    min_stock: import_zod25.z.number().nullish(),
    barcode: import_zod25.z.string().nullish(),
    category: import_zod25.z.string().nullish(),
    active: import_zod25.z.boolean().optional(),
    isItem: import_zod25.z.boolean().optional()
  });
  const { id } = updateItemParamsSchema.parse(request.params);
  const data = updateItemBodySchema.parse(request.body);
  try {
    const updateItemUseCase = makeUpdateItemUseCase();
    const { item } = await updateItemUseCase.execute({
      id,
      ...data,
      description: data.description ?? void 0,
      min_stock: data.min_stock ?? void 0,
      barcode: data.barcode ?? void 0,
      category: data.category ?? void 0
    });
    return reply.status(200).send(item);
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(400).send({ message: err.message });
    }
    throw err;
  }
}

// src/http/controllers/items/deleteItem.ts
var import_zod26 = require("zod");

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

// src/http/controllers/items/deleteItem.ts
async function deleteItem(request, reply) {
  const deleteItemParamsSchema = import_zod26.z.object({
    id: import_zod26.z.string().uuid()
  });
  const { id } = deleteItemParamsSchema.parse(request.params);
  try {
    const deleteItemUseCase = makeDeleteItemUseCase();
    await deleteItemUseCase.execute({ itemId: id });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(400).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

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

// src/use-cases/get-inventory-summary.ts
var GetInventorySummaryUseCase = class {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }
  async execute() {
    const inventorySummary = await this.inventoryRepository.getInventorySummary();
    return { inventorySummary };
  }
};

// src/use-cases/factories/make-get-inventory-summary-use-case.ts
function MakeGetInventorySummaryUseCase() {
  const inventoryRepository = new PrismaInventoryRepository();
  const getInventorySummaryUseCase = new GetInventorySummaryUseCase(inventoryRepository);
  return getInventorySummaryUseCase;
}

// src/http/controllers/items/get-inventory-summary.ts
async function getInventorySummary(request, reply) {
  let inventorySummary;
  try {
    const getInventorySummaryUseCase = MakeGetInventorySummaryUseCase();
    inventorySummary = await getInventorySummaryUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(inventorySummary);
}

// src/http/controllers/items/routes.ts
async function itemsRoutes(app2) {
  app2.addHook("onRequest", verifyJWT);
  app2.post("/item", createItem);
  app2.patch("/item/:id", updateItem);
  app2.delete("/item/:id", deleteItem);
  app2.post("/stock", createStock);
  app2.get("/items", getItems);
  app2.get("/item-stocks/:id", getItemHistory);
  app2.get("/inventory-summary", getInventorySummary);
}

// src/use-cases/treatment.ts
var TreatmentUseCase = class {
  constructor(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository) {
    this.treatmentsRepository = treatmentsRepository;
    this.clientsRepository = clientsRepository;
    this.equipmentsRepository = equipmentsRepository;
    this.usersRepository = usersRepository;
  }
  async execute({
    opening_date,
    contact,
    client_id,
    equipment_id,
    user_id,
    request,
    status,
    amount,
    observations,
    ending_date
  }) {
    let user;
    if (user_id) {
      user = await this.usersRepository.findById(user_id);
      if (!user)
        throw new ResourceNotFoundError();
    }
    let client;
    if (client_id) {
      client = await this.clientsRepository.findById(client_id);
      if (!client)
        throw new ResourceNotFoundError();
    }
    let equipment;
    if (equipment_id) {
      equipment = await this.equipmentsRepository.findById(equipment_id);
      if (!equipment)
        throw new ResourceNotFoundError();
    }
    const treatment = await this.treatmentsRepository.create({
      opening_date,
      contact,
      client_id,
      equipment_id,
      request,
      status,
      amount,
      observations,
      ending_date
    });
    return {
      treatment
    };
  }
};

// src/use-cases/factories/make-treatment-use-case.ts
function MakeTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const clientsRepository = new PrismaClientsRepository();
  const equipmentsRepository = new PrismaEquipmentsRepository();
  const usersRepository = new PrismaUsersRepository();
  const treatmentUseCase = new TreatmentUseCase(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository);
  return treatmentUseCase;
}

// src/http/controllers/treatments/treatment.ts
var import_zod27 = require("zod");
async function createTreatment(request, reply) {
  const registerBodySchema = import_zod27.z.object({
    opening_date: import_zod27.z.coerce.date().nullish(),
    ending_date: import_zod27.z.coerce.date().nullish(),
    contact: import_zod27.z.string().nullish(),
    user_id: import_zod27.z.string().nullish(),
    client_id: import_zod27.z.string().nullish(),
    equipment_id: import_zod27.z.string().nullish(),
    request: import_zod27.z.string(),
    status: import_zod27.z.string().nullish(),
    amount: import_zod27.z.number().nullish(),
    observations: import_zod27.z.string().nullish()
  });
  const { opening_date, ending_date, contact, user_id, client_id, equipment_id, status, amount, observations } = registerBodySchema.parse(request.body);
  const test = registerBodySchema.parse(request.body);
  let treatment;
  try {
    const treatmentUseCase = MakeTreatmentUseCase();
    treatment = await treatmentUseCase.execute({
      opening_date: opening_date ? opening_date : /* @__PURE__ */ new Date(),
      ending_date: status === "resolved" ? /* @__PURE__ */ new Date() : void 0,
      contact: contact ? contact : void 0,
      user_id: user_id ? user_id : void 0,
      client_id: client_id ? client_id : void 0,
      equipment_id: equipment_id ? equipment_id : void 0,
      request: test.request,
      status: status ? status : "pending",
      amount: amount ? amount : 0,
      observations: observations ? observations : void 0
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(treatment);
}

// src/repositories/prisma/prisma-treatment-items-repository.ts
var PrismaTreatmentItemsRepository = class {
  async findById(id) {
    const treatmentItem = await prisma.treatmentItem.findFirst({ where: { id } });
    return treatmentItem;
  }
  async remove(id) {
    await prisma.treatmentItem.delete({
      where: { id }
    });
  }
  async findByTreatment(treatment_id) {
    const treatmentItems = prisma.treatmentItem.findMany({
      where: {
        treatment_id
      }
    });
    return treatmentItems;
  }
  async linkStock(id, stock_id) {
    await prisma.treatmentItem.update({
      where: { id },
      data: { stock_id }
    });
  }
  update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    await prisma.treatmentItem.delete({
      where: {
        id
      }
    });
  }
  async create(data) {
    const treatmentItem = prisma.treatmentItem.create({
      data
    });
    return treatmentItem;
  }
};

// src/use-cases/errors/insufficient-stock-error.ts
var InsufficientStockError = class extends Error {
  constructor(message) {
    super(message || "Estoquel insuficiente.");
  }
};

// src/use-cases/treatmentItem.ts
var TreatmentItemUseCase = class {
  constructor(treatmentItemsRepository, treatmentsRepository, itemsRepository, stocksRepository) {
    this.treatmentItemsRepository = treatmentItemsRepository;
    this.treatmentsRepository = treatmentsRepository;
    this.itemsRepository = itemsRepository;
    this.stocksRepository = stocksRepository;
  }
  async execute({
    item_id,
    treatment_id,
    stock_id,
    quantity,
    salesValue,
    discount
  }) {
    let item;
    if (item_id) {
      item = await this.itemsRepository.findById(item_id);
      if (!item)
        throw new ResourceNotFoundError();
    }
    let treatment;
    if (treatment_id) {
      treatment = await this.treatmentsRepository.findById(treatment_id);
      if (!treatment)
        throw new ResourceNotFoundError();
    }
    let stock;
    if (stock_id) {
      stock = await this.stocksRepository.findById(stock_id);
      if (!stock)
        throw new ResourceNotFoundError();
    }
    if (quantity <= 0 || salesValue < 0)
      throw new OnlyNaturalNumbersError();
    const isService = !item?.isItem || item?.name?.toLowerCase().includes("clonagem") || item?.category?.toLowerCase().includes("servi");
    if (item && !isService && item.stock !== null && quantity > item.stock) {
      console.error(`[TreatmentItemUseCase] Stock Blocked: Item ${item.name} (isItem: ${item.isItem}), Stock: ${item.stock}, Req: ${quantity}`);
      throw new InsufficientStockError(`Estoque insuficiente. Dispon\xEDvel: ${item.stock}, Requisitado: ${quantity}`);
    }
    const treatmentItem = await this.treatmentItemsRepository.create({
      treatment_id,
      item_id,
      stock_id,
      quantity,
      salesValue,
      discount
    });
    return {
      treatmentItem
    };
  }
};

// src/use-cases/factories/make-treatment-item-use-case.ts
function MakeTreatmentItemUseCase() {
  const treatmentItemsRepository = new PrismaTreatmentItemsRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const itemsRepository = new PrismaItemsRepository();
  const stocksRepository = new PrismaStocksRepository();
  const treatmentItemUseCase = new TreatmentItemUseCase(
    treatmentItemsRepository,
    treatmentsRepository,
    itemsRepository,
    stocksRepository
  );
  return treatmentItemUseCase;
}

// src/http/controllers/treatments/treatment-item.ts
var import_zod28 = require("zod");
async function createItemTreatment(request, reply) {
  const registerBodySchema = import_zod28.z.object({
    treatment_id: import_zod28.z.string(),
    item_id: import_zod28.z.string(),
    stock_id: import_zod28.z.string().nullish(),
    quantity: import_zod28.z.number(),
    value: import_zod28.z.number(),
    discount: import_zod28.z.number().nullish()
  });
  console.log("Controller createItemTreatment body:", request.body);
  const { treatment_id, item_id, stock_id, quantity, value, discount } = registerBodySchema.parse(request.body);
  let itemTreatment;
  try {
    const itemtreatmentUseCase = MakeTreatmentItemUseCase();
    itemTreatment = await itemtreatmentUseCase.execute({
      treatment_id,
      item_id,
      stock_id: stock_id ? stock_id : void 0,
      quantity,
      salesValue: value,
      discount: discount ? discount : 0
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return reply.status(400).send({ message: err.message });
    }
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(itemTreatment);
}

// src/use-cases/get-treatments.ts
var GetTreatmentsUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({ pageIndex, perPage, treatmentId, clientName, status }) {
    if (!perPage)
      perPage = 6;
    try {
      const result = await this.treatmentsRepository.findByActive(pageIndex, perPage, treatmentId, clientName, status);
      return result;
    } catch (error) {
      console.error("[GetTreatmentsUseCase] Error executing repository query:", error);
      return null;
    }
  }
};

// src/use-cases/factories/make-get-treatments-use-case.ts
function MakeGetTreatmentsUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const getTreatmentUseCase = new GetTreatmentsUseCase(treatmentsRepository);
  return getTreatmentUseCase;
}

// src/http/controllers/treatments/getTreatments.ts
var import_zod29 = require("zod");
async function getTreatments(request, reply) {
  try {
    console.log("[GetTreatments] Query Params:", request.query);
    const getTreatmentsParamsSchema = import_zod29.z.object({
      page: import_zod29.z.coerce.string().default("1"),
      treatmentId: import_zod29.z.string().nullish(),
      clientName: import_zod29.z.string().nullish(),
      status: import_zod29.z.string().nullish()
    });
    const { page, treatmentId, clientName, status } = getTreatmentsParamsSchema.parse(request.query);
    const getTreatmentUseCase = MakeGetTreatmentsUseCase();
    const result = await getTreatmentUseCase.execute({
      pageIndex: parseInt(page),
      treatmentId: treatmentId || void 0,
      // Convert null/empty to undefined
      clientName: clientName || void 0,
      status: status || void 0
    });
    if (!result) {
      return reply.status(200).send({ treatments: [], totalCount: 0, perPage: 10, pageIndex: 1 });
    }
    return reply.status(200).send(result);
  } catch (err) {
    console.error("[GetTreatments] Error:", err);
    if (err instanceof Error) {
      return reply.status(500).send({ message: err.message });
    }
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

// src/use-cases/remove-treatment-item.ts
var RemoveTreatmentItemUseCase = class {
  constructor(treatmentItemsRepository, treatmentsRepository) {
    this.treatmentItemsRepository = treatmentItemsRepository;
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    id
  }) {
    const treatmentItem = await this.treatmentItemsRepository.findById(id);
    if (!treatmentItem) {
      throw new ResourceNotFoundError();
    } else {
      await this.treatmentItemsRepository.remove(id);
    }
  }
};

// src/use-cases/factories/make-remove-treatment-item-use-case.ts
function MakeRemoveTreatmentItemUseCase() {
  const treatmentItemsRepository = new PrismaTreatmentItemsRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const treatmentItemUseCase = new RemoveTreatmentItemUseCase(
    treatmentItemsRepository,
    treatmentsRepository
  );
  return treatmentItemUseCase;
}

// src/http/controllers/treatments/remove-treatment-item.ts
var import_zod30 = require("zod");
async function RemoveTreatmentItem(request, reply) {
  const deleteItemTreatmentParamsSchema = import_zod30.z.object({
    id: import_zod30.z.string().uuid()
  });
  console.log(request);
  const { id } = deleteItemTreatmentParamsSchema.parse(request.params);
  try {
    const removeTreatmentItemUseCase = MakeRemoveTreatmentItemUseCase();
    await removeTreatmentItemUseCase.execute({
      id
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(204).send();
}

// src/http/controllers/treatments/getTreatment.ts
var import_zod31 = require("zod");

// src/use-cases/get-treatment.ts
var GetTreatmentUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({ treatmentId }) {
    const treatment = await this.treatmentsRepository.findById(treatmentId);
    return treatment;
  }
};

// src/use-cases/factories/make-get-treatment-use-case.ts
function MakeGetTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const getTreatmentUseCase = new GetTreatmentUseCase(treatmentsRepository);
  return getTreatmentUseCase;
}

// src/http/controllers/treatments/getTreatment.ts
async function getTreatment(request, reply) {
  const getTreatmentsParamsSchema = import_zod31.z.object({
    id: import_zod31.z.string().uuid()
  });
  const { id } = getTreatmentsParamsSchema.parse(request.params);
  let treatments;
  try {
    const getTreatmentUseCase = MakeGetTreatmentUseCase();
    treatments = await getTreatmentUseCase.execute({
      treatmentId: id
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send({
    treatments
  });
}

// src/use-cases/update-treatment.ts
var UpdateTreatmentUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    id,
    opening_date,
    ending_date,
    contact,
    user_id,
    client_id,
    equipment_id,
    request,
    status,
    observations
  }) {
    const treatment = await this.treatmentsRepository.update(id, {
      opening_date,
      ending_date,
      contact,
      user_id,
      client_id,
      equipment_id,
      request,
      status,
      observations
    });
    return {
      treatment
    };
  }
};

// src/use-cases/factories/make-update-treatment-use-case.ts
function MakeUpdateTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const registerUseCase = new UpdateTreatmentUseCase(treatmentsRepository);
  return registerUseCase;
}

// src/http/controllers/treatments/updateTreatment.ts
var import_zod32 = require("zod");
async function updateTreatment(request, reply) {
  const updateTreatmentBodySchema = import_zod32.z.object({
    opening_date: import_zod32.z.coerce.date().nullish(),
    ending_date: import_zod32.z.coerce.date().nullish(),
    contact: import_zod32.z.string().nullish(),
    user_id: import_zod32.z.string().nullish(),
    client_id: import_zod32.z.string().nullish(),
    equipment_id: import_zod32.z.string().nullish(),
    request: import_zod32.z.string().nullish(),
    status: import_zod32.z.string().nullish(),
    amount: import_zod32.z.number().nullish(),
    observations: import_zod32.z.string().nullish()
  });
  const idUpdateTreatmentBodySchema = import_zod32.z.object({
    id: import_zod32.z.string().uuid()
  });
  const {
    opening_date,
    ending_date,
    contact,
    user_id,
    client_id,
    equipment_id,
    status,
    observations
  } = updateTreatmentBodySchema.parse(request.body);
  const { id } = idUpdateTreatmentBodySchema.parse(request.params);
  const test = updateTreatmentBodySchema.parse(request.body);
  let treatment;
  try {
    const updateTreatmentUseCase = MakeUpdateTreatmentUseCase();
    treatment = await updateTreatmentUseCase.execute({
      id,
      opening_date: opening_date ? opening_date : void 0,
      ending_date: status === "resolved" ? /* @__PURE__ */ new Date() : ending_date ? ending_date : void 0,
      contact: contact ? contact : void 0,
      user_id: user_id ? user_id : void 0,
      client_id: client_id ? client_id : void 0,
      equipment_id: equipment_id ? equipment_id : void 0,
      request: test.request ? test.request : void 0,
      status: status ? status : void 0,
      observations: observations ? observations : void 0
    });
  } catch (err) {
    if (err) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(treatment);
}

// src/repositories/prisma/prisma-interactions-repository.ts
var PrismaInteractionsRepository = class {
  async create(data) {
    const interaction = await prisma.interaction.create({
      data
    });
    return interaction;
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    prisma.interaction.delete({
      where: {
        id
      }
    });
  }
  findByTreatment(treatment_id) {
    const interactions = prisma.interaction.findMany({
      where: {
        treatment_id
      }
    });
    return interactions;
  }
};

// src/use-cases/interaction.ts
var InteractionUseCase = class {
  constructor(interactionsRepository, usersRepository, treatmentsRepository) {
    this.interactionsRepository = interactionsRepository;
    this.usersRepository = usersRepository;
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    user_id,
    treatment_id,
    date,
    description
  }) {
    const user = await this.usersRepository.findById(user_id);
    if (!user) {
      console.log("usuario n\xE3o encontrado");
      throw new ResourceNotFoundError();
    }
    const treatment = await this.treatmentsRepository.findById(treatment_id);
    if (!treatment) {
      console.log("atendimento n\xE3o encontrado");
      throw new ResourceNotFoundError();
    }
    const interaction = await this.interactionsRepository.create({
      user_id,
      treatment_id,
      date,
      description
    });
    return {
      interaction
    };
  }
};

// src/use-cases/factories/make-interaction-use-case.ts
function MakeInteractionUseCase() {
  const interactionsRepository = new PrismaInteractionsRepository();
  const usersRepository = new PrismaUsersRepository();
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const interactionUseCase = new InteractionUseCase(interactionsRepository, usersRepository, treatmentsRepository);
  return interactionUseCase;
}

// src/http/controllers/treatments/interaction.ts
var import_zod33 = require("zod");
async function createInteraction(request, reply) {
  const createInteractionParams = import_zod33.z.object({
    id: import_zod33.z.string().uuid()
  });
  const createInteractionBodySchema = import_zod33.z.object({
    date: import_zod33.z.coerce.date().nullish(),
    description: import_zod33.z.string()
  });
  const { date, description } = createInteractionBodySchema.parse(request.body);
  const { id } = createInteractionParams.parse(request.params);
  let interaction;
  try {
    const interactionUseCase = MakeInteractionUseCase();
    interaction = await interactionUseCase.execute({
      user_id: request.user.sub,
      treatment_id: id,
      date: date ? date : /* @__PURE__ */ new Date(),
      description
    });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(interaction);
}

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

// src/use-cases/get-service-management-data.ts
var GetServiceManagementDataUseCase = class {
  constructor(serviceManagementRepository) {
    this.serviceManagementRepository = serviceManagementRepository;
  }
  async execute() {
    const serviceData = await this.serviceManagementRepository.getServiceManagementData();
    return { serviceData };
  }
};

// src/use-cases/factories/make-get-service-management-data-use-case.ts
function MakeGetServiceManagementDataUseCase() {
  const serviceManagementRepository = new PrismaServiceManagementRepository();
  const getServiceManagementDataUseCase = new GetServiceManagementDataUseCase(serviceManagementRepository);
  return getServiceManagementDataUseCase;
}

// src/http/controllers/treatments/get-service-management-data.ts
async function getServiceManagementData(request, reply) {
  let serviceData;
  try {
    const getServiceManagementDataUseCase = MakeGetServiceManagementDataUseCase();
    serviceData = await getServiceManagementDataUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(serviceData);
}

// src/http/controllers/treatments/finish.ts
var import_zod34 = require("zod");

// src/use-cases/finish-treatment.ts
var FinishTreatmentUseCase = class {
  constructor(treatmentsRepository, paymentEntrysRepository, itemsRepository, transactionsRepository, accountsRepository) {
    this.treatmentsRepository = treatmentsRepository;
    this.paymentEntrysRepository = paymentEntrysRepository;
    this.itemsRepository = itemsRepository;
    this.transactionsRepository = transactionsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    treatment_id
  }) {
    const treatment = await this.treatmentsRepository.findById(treatment_id);
    if (!treatment) {
      throw new ResourceNotFoundError();
    }
    if (treatment.status === "resolved" || treatment.status === "finished") {
      throw new Error("Treatment already finished");
    }
    const calculatedTotal = treatment.amount;
    const paymentEntries = await this.paymentEntrysRepository.findByTreatmentId(treatment_id);
    const totalPaid = paymentEntries?.reduce((acc, entry) => acc + Number(entry.amount) * entry.occurrences, 0) || 0;
    if (totalPaid < treatment.amount - 0.05) {
      throw new Error(`Pagamento insuficiente. Total a pagar: ${treatment.amount.toFixed(2)}, Pago: ${totalPaid.toFixed(2)}`);
    }
    return await prisma.$transaction(async (tx) => {
      if (treatment.items) {
        for (const tItem of treatment.items) {
          const itemData = tItem.items;
          if (itemData && itemData.isItem) {
            await this.itemsRepository.changeStock(tItem.item_id, tItem.quantity, false, tx);
            await tx.stock.create({
              data: {
                item_id: tItem.item_id,
                quantity: tItem.quantity,
                // @ts-ignore
                operation: "OUT",
                // @ts-ignore
                description: "VENDA",
                created_at: /* @__PURE__ */ new Date()
              }
            });
          }
        }
      }
      if (paymentEntries) {
        for (const entry of paymentEntries) {
          const paymentMethod = entry.payments;
          if (!paymentMethod) continue;
          const accountId = paymentMethod.account_id;
          if (!accountId) {
            console.warn(`Payment method ${paymentMethod.name} has no account linked. Skipping transaction creation.`);
            continue;
          }
          for (let i = 0; i < entry.occurrences; i++) {
            const dueDate = /* @__PURE__ */ new Date();
            dueDate.setMonth(dueDate.getMonth() + i);
            let isConfirmed = false;
            if (paymentMethod.in_sight) {
              isConfirmed = true;
            }
            const transaction = await this.transactionsRepository.create({
              amount: entry.amount,
              operation: "income",
              date: dueDate,
              account_id: accountId,
              description: `Atendimento #${treatment.id} - ${paymentMethod.name} (${i + 1}/${entry.occurrences})`,
              confirmed: isConfirmed
            }, tx);
            if (isConfirmed) {
              await this.accountsRepository.changeBalance(accountId, entry.amount, true, tx);
            }
          }
        }
      }
      const closedTreatment = await this.treatmentsRepository.close(treatment_id, tx);
      if (!closedTreatment) throw new ResourceNotFoundError();
      return { treatment: closedTreatment };
    });
  }
};

// src/use-cases/factories/make-finish-treatment-use-case.ts
function MakeFinishTreatmentUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const paymentEntrysRepository = new PrismaPaymentEntrysRepository();
  const itemsRepository = new PrismaItemsRepository();
  const transactionsRepository = new PrismaTransactionsRepository();
  const accountsRepository = new PrismaAccountsRepository();
  const finishTreatmentUseCase = new FinishTreatmentUseCase(
    treatmentsRepository,
    paymentEntrysRepository,
    itemsRepository,
    transactionsRepository,
    accountsRepository
  );
  return finishTreatmentUseCase;
}

// src/http/controllers/treatments/finish.ts
async function finish(request, reply) {
  const finishTreatmentParamsSchema = import_zod34.z.object({
    id: import_zod34.z.string().uuid()
  });
  const { id } = finishTreatmentParamsSchema.parse(request.params);
  try {
    const finishTreatmentUseCase = MakeFinishTreatmentUseCase();
    await finishTreatmentUseCase.execute({
      treatment_id: id
    });
    return reply.status(200).send({ message: "Treatment finished successfully" });
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return reply.status(404).send({ message: err.message });
    }
    if (err instanceof Error) {
      return reply.status(400).send({ message: err.message });
    }
    throw err;
  }
}

// src/http/controllers/treatments/routes.ts
async function treatmentsRoutes(app2) {
  app2.addHook("onRequest", verifyJWT);
  app2.get("/treatments", getTreatments);
  app2.get("/treatment/:id", getTreatment);
  app2.patch("/treatment/:id", updateTreatment);
  app2.post("/treatment/:id/interaction", createInteraction);
  app2.post("/treatment", createTreatment);
  app2.post("/treatment-item", createItemTreatment);
  app2.delete("/treatment-item/:id", RemoveTreatmentItem);
  app2.patch("/treatment/:id/finish", finish);
  app2.get("/service-management", getServiceManagementData);
}

// src/app.ts
var import_cookie = __toESM(require("@fastify/cookie"));
var import_cors = __toESM(require("@fastify/cors"));

// src/use-cases/get-month-treatments-amount.ts
var GetMonthTreatmentsAmountUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute() {
    const metrics = await this.treatmentsRepository.getMonthTreatmentsAmount();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-treatments-amount.ts
function makeGetMonthTreatmentsAmountUseCase() {
  const treatmentsRepository = new PrismaTreatmentsRepository();
  const getTreatmentProfileUseCase = new GetMonthTreatmentsAmountUseCase(treatmentsRepository);
  return getTreatmentProfileUseCase;
}

// src/http/controllers/metrics/getMonthTreatmentsAmount.ts
async function getMonthTreatmentsAmount(request, reply) {
  let monthTreatmentsAmount;
  try {
    const getMonthTreatmentsAmountUseCase = makeGetMonthTreatmentsAmountUseCase();
    monthTreatmentsAmount = await getMonthTreatmentsAmountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthTreatmentsAmount);
}

// src/use-cases/get-month-income-amount.ts
var GetMonthIncomeAmountUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthIncomeAmount();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-income-amount-use-case.ts
function MakeGetMonthIncomeAmountUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getTransactionProfileUseCase = new GetMonthIncomeAmountUseCase(transactionsRepository);
  return getTransactionProfileUseCase;
}

// src/http/controllers/metrics/getMonthIncomeAmount.ts
async function getMonthIncomeAmount(request, reply) {
  let monthIncomeAmount;
  try {
    const getMonthIncomeAmountUseCase = MakeGetMonthIncomeAmountUseCase();
    monthIncomeAmount = await getMonthIncomeAmountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthIncomeAmount);
}

// src/use-cases/get-month-expense-amount.ts
var GetMonthExpenseAmountUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthExpenseAmount();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-expense-amount-use-case.ts
function MakeGetMonthExpenseAmountUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getTransactionProfileUseCase = new GetMonthExpenseAmountUseCase(transactionsRepository);
  return getTransactionProfileUseCase;
}

// src/http/controllers/metrics/getMonthExpenseAmount.ts
async function getMonthExpenseAmount(request, reply) {
  let monthExpenseAmount;
  try {
    const getMonthExpenseAmountUseCase = MakeGetMonthExpenseAmountUseCase();
    monthExpenseAmount = await getMonthExpenseAmountUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthExpenseAmount);
}

// src/use-cases/get-month-income-by-days.ts
var GetMonthIncomeByDaysUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthIncomeByDays();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-income-by-days.ts
function MakeGetMonthByDaysUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getMonthIncomeByDaysUseCase = new GetMonthIncomeByDaysUseCase(transactionsRepository);
  return getMonthIncomeByDaysUseCase;
}

// src/http/controllers/metrics/getMonthIncomeByDay.ts
async function getMonthIncomeByDay(request, reply) {
  let monthIncomeByDay;
  try {
    const getMonthIncomeByDayUseCase = MakeGetMonthByDaysUseCase();
    monthIncomeByDay = await getMonthIncomeByDayUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthIncomeByDay);
}

// src/use-cases/get-month-expense-by-sector.ts
var GetMonthExpenseBySectorUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getMonthExpenseBySector();
    return metrics;
  }
};

// src/use-cases/factories/make-get-month-expense-by-sector.ts
function MakeGetMonthExpenseBySectorUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getMonthExpenseBySectorUseCase = new GetMonthExpenseBySectorUseCase(transactionsRepository);
  return getMonthExpenseBySectorUseCase;
}

// src/http/controllers/metrics/getMonthExpenseBySector.ts
async function getMonthExpenseBySector(request, reply) {
  let monthExpenseBySector;
  try {
    const getMonthExpenseBySectorUseCase = MakeGetMonthExpenseBySectorUseCase();
    monthExpenseBySector = await getMonthExpenseBySectorUseCase.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(monthExpenseBySector);
}

// src/use-cases/get-general-balance.ts
var GetGeneralBalanceUseCase = class {
  constructor(transactionsRepository) {
    this.transactionsRepository = transactionsRepository;
  }
  async execute() {
    const metrics = await this.transactionsRepository.getBalance();
    return metrics;
  }
};

// src/use-cases/factories/make-get-general-balance.ts
function MakeGetGeneralBalanceUseCase() {
  const transactionsRepository = new PrismaTransactionsRepository();
  const getGeneralBalanceUseCase = new GetGeneralBalanceUseCase(transactionsRepository);
  return getGeneralBalanceUseCase;
}

// src/http/controllers/metrics/getGeneralBalance.ts
async function getGeneralBalance(request, reply) {
  let genetalBalance;
  try {
    const getGeneralBalance2 = MakeGetGeneralBalanceUseCase();
    genetalBalance = await getGeneralBalance2.execute();
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(genetalBalance);
}

// src/repositories/prisma/prisma-balance-projection-repository.ts
var PrismaBalanceProjectionRepository = class {
  async getBalanceProjection(days = 30) {
    const currentDate = /* @__PURE__ */ new Date();
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const accounts = await prisma.account.findMany({
      select: {
        balance: true
      }
    });
    const currentBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const futureTransactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: today,
          // Apenas a partir de hoje
          lte: endDate
        }
      },
      select: {
        date: true,
        operation: true,
        amount: true,
        confirmed: true
      },
      orderBy: {
        date: "asc"
      }
    });
    const dailyBalances = this.generateDailyBalances(
      currentBalance,
      today,
      endDate,
      futureTransactions
    );
    return {
      currentBalance,
      dailyBalances
    };
  }
  generateDailyBalances(initialBalance, startDate, endDate, transactions) {
    const dailyBalances = [];
    let runningBalance = initialBalance;
    const today = /* @__PURE__ */ new Date();
    const todayString = today.toISOString().split("T")[0];
    const todayTransactions = transactions.filter(
      (t) => new Date(t.date).toISOString().split("T")[0] === todayString
    );
    const todayBalanceChange = todayTransactions.reduce((sum, transaction) => {
      if (transaction.operation === "income") {
        return sum + transaction.amount;
      } else {
        return sum - transaction.amount;
      }
    }, 0);
    runningBalance += todayBalanceChange;
    dailyBalances.push({
      date: todayString,
      balance: runningBalance,
      isProjection: todayTransactions.some((t) => !t.confirmed)
      // Projeção se tiver pendentes
    });
    const transactionsByDate = /* @__PURE__ */ new Map();
    transactions.forEach((transaction) => {
      const dateString = new Date(transaction.date).toISOString().split("T")[0];
      if (!transactionsByDate.has(dateString)) {
        transactionsByDate.set(dateString, []);
      }
      transactionsByDate.get(dateString).push(transaction);
    });
    const uniqueDates = Array.from(transactionsByDate.keys()).filter((dateString) => dateString !== todayString).sort();
    const limitedDates = uniqueDates.slice(0, 29);
    limitedDates.forEach((dateString) => {
      const dayTransactions = transactionsByDate.get(dateString) || [];
      const dayBalanceChange = dayTransactions.reduce((sum, transaction) => {
        if (transaction.operation === "income") {
          return sum + transaction.amount;
        } else {
          return sum - transaction.amount;
        }
      }, 0);
      runningBalance += dayBalanceChange;
      const date = new Date(dateString);
      const isFutureDate = date > today;
      const hasPendingTransactions = dayTransactions.some((t) => !t.confirmed);
      const isProjection = isFutureDate || hasPendingTransactions;
      dailyBalances.push({
        date: dateString,
        balance: runningBalance,
        isProjection
      });
    });
    return dailyBalances;
  }
};

// src/use-cases/get-balance-projection.ts
var GetBalanceProjectionUseCase = class {
  constructor(balanceProjectionRepository) {
    this.balanceProjectionRepository = balanceProjectionRepository;
  }
  async execute({ days = 30 } = {}) {
    const projection = await this.balanceProjectionRepository.getBalanceProjection(days);
    return { projection };
  }
};

// src/use-cases/factories/make-get-balance-projection-use-case.ts
function MakeGetBalanceProjectionUseCase() {
  const balanceProjectionRepository = new PrismaBalanceProjectionRepository();
  const getBalanceProjectionUseCase = new GetBalanceProjectionUseCase(balanceProjectionRepository);
  return getBalanceProjectionUseCase;
}

// src/http/controllers/metrics/get-balance-projection.ts
async function getBalanceProjection(request, reply) {
  let projection;
  try {
    const days = request.query.days ? parseInt(request.query.days) : void 0;
    const getBalanceProjectionUseCase = MakeGetBalanceProjectionUseCase();
    projection = await getBalanceProjectionUseCase.execute({ days });
  } catch (err) {
    if (err instanceof Error) {
      return reply.status(409).send({ message: err.message });
    }
    throw err;
  }
  return reply.status(200).send(projection);
}

// src/http/controllers/metrics/routes.ts
async function metricsRoutes(app2) {
  app2.addHook("onRequest", verifyJWT);
  app2.get("/metrics/month-treatments-amount", getMonthTreatmentsAmount);
  app2.get("/metrics/month-income-amount", getMonthIncomeAmount);
  app2.get("/metrics/month-expense-amount", getMonthExpenseAmount);
  app2.get("/metrics/month-income-by-days", getMonthIncomeByDay);
  app2.get("/metrics/month-expense-by-sector", getMonthExpenseBySector);
  app2.get("/metrics/general-balance", getGeneralBalance);
  app2.get("/balance-projection", getBalanceProjection);
}

// src/app.ts
var app = (0, import_fastify.default)({ logger: true });
app.register(import_cors.default, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // ← ADD ESTA LINHA
  credentials: true
  // ← importante para cookies/tokens
});
app.register(
  import_jwt.default,
  {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "refreshToken",
      signed: false
    },
    sign: {
      expiresIn: "10d"
    }
  }
);
app.register(import_cookie.default);
app.register(usersRoutes);
app.register(financialRoutes);
app.register(clientsRoutes);
app.register(itemsRoutes);
app.register(treatmentsRoutes);
app.register(metricsRoutes);
app.setErrorHandler((error, _, reply) => {
  if (error instanceof import_zod35.ZodError) {
    return reply.status(400).send({ message: "Erro de valida\xE7\xE3o", issues: error.format() });
  }
  if (env.NODE_ENV !== "production") {
    console.error(error);
  } else {
  }
  return reply.status(500).send({ messagem: "Erro interno do servidor" });
});

// src/server.ts
app.listen({
  //facilita o front-end de acessar o back
  host: "0.0.0.0",
  port: env.PORT
}).then(() => {
  console.log("Servidor HTTP Rodando \u{1F488}!");
});
