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

// src/use-cases/transferTransaction.ts
var transferTransaction_exports = {};
__export(transferTransaction_exports, {
  TransferTransactionUseCase: () => TransferTransactionUseCase
});
module.exports = __toCommonJS(transferTransaction_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/transferTransaction.ts
var TransferTransactionUseCase = class {
  constructor(transferTransactionssRepository, transactionsRepository, accountsRepository) {
    this.transferTransactionssRepository = transferTransactionssRepository;
    this.transactionsRepository = transactionsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    destination_account_id,
    transaction_id
  }) {
    let account;
    if (destination_account_id) {
      account = await this.accountsRepository.findById(destination_account_id);
      if (!account)
        throw new ResourceNotFoundError();
    }
    let transaction;
    if (transaction_id) {
      transaction = await this.transactionsRepository.findById(transaction_id);
      if (!transaction)
        throw new ResourceNotFoundError();
    }
    const transferTransactions = await this.transferTransactionssRepository.create({
      transaction_id,
      destination_account_id
    });
    return {
      transferTransactions
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TransferTransactionUseCase
});
