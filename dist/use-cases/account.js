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

// src/use-cases/account.ts
var account_exports = {};
__export(account_exports, {
  AccountUseCase: () => AccountUseCase
});
module.exports = __toCommonJS(account_exports);

// src/use-cases/errors/this-name-already-exists-error.ts
var ThisNameAlreadyExistsError = class extends Error {
  constructor() {
    super("Nome j\xE1 cadastrado");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AccountUseCase
});
