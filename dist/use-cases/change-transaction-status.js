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

// src/use-cases/change-transaction-status.ts
var change_transaction_status_exports = {};
__export(change_transaction_status_exports, {
  ChangeTransactionUseCase: () => ChangeTransactionUseCase
});
module.exports = __toCommonJS(change_transaction_status_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChangeTransactionUseCase
});
