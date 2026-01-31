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

// src/use-cases/get-transactions.ts
var get_transactions_exports = {};
__export(get_transactions_exports, {
  GetTransactionsUseCase: () => GetTransactionsUseCase
});
module.exports = __toCommonJS(get_transactions_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GetTransactionsUseCase
});
