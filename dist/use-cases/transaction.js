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

// src/use-cases/transaction.ts
var transaction_exports = {};
__export(transaction_exports, {
  TransactionUseCase: () => TransactionUseCase
});
module.exports = __toCommonJS(transaction_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TransactionUseCase
});
