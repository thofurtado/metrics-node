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

// src/use-cases/delete-transaction.ts
var delete_transaction_exports = {};
__export(delete_transaction_exports, {
  DeleteTransactionUseCase: () => DeleteTransactionUseCase
});
module.exports = __toCommonJS(delete_transaction_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/errors/transaction-already-confirmed-error.ts
var TransactionAlreadyConfirmedError = class extends Error {
  constructor() {
    super("Transaction is already confirmed and cannot be changed.");
    this.name = "TransactionAlreadyConfirmedError";
  }
};

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DeleteTransactionUseCase
});
