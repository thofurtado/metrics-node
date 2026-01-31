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

// src/use-cases/update-account.ts
var update_account_exports = {};
__export(update_account_exports, {
  UpdateAccountUseCase: () => UpdateAccountUseCase
});
module.exports = __toCommonJS(update_account_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UpdateAccountUseCase
});
