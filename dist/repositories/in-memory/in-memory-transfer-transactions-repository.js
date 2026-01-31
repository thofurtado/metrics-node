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

// src/repositories/in-memory/in-memory-transfer-transactions-repository.ts
var in_memory_transfer_transactions_repository_exports = {};
__export(in_memory_transfer_transactions_repository_exports, {
  InMemoryTransferTransactionsRepository: () => InMemoryTransferTransactionsRepository
});
module.exports = __toCommonJS(in_memory_transfer_transactions_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryTransferTransactionsRepository = class {
  constructor() {
    this.items = [];
  }
  async findMany() {
    const transferTransactions = this.items;
    return transferTransactions;
  }
  async findByAccount(account_id) {
    const transferTransactions = this.items.filter((item) => item.destination_account_id === account_id);
    return transferTransactions;
  }
  async create(data) {
    const transaction = {
      id: (0, import_node_crypto.randomUUID)(),
      destination_account_id: data.destination_account_id,
      transaction_id: data.transaction_id
    };
    this.items.push(transaction);
    return transaction;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryTransferTransactionsRepository
});
