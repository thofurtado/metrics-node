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

// src/use-cases/get-accounts.ts
var get_accounts_exports = {};
__export(get_accounts_exports, {
  GetAccountsUseCase: () => GetAccountsUseCase
});
module.exports = __toCommonJS(get_accounts_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GetAccountsUseCase
});
