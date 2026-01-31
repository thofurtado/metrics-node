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

// src/use-cases/update-payment.ts
var update_payment_exports = {};
__export(update_payment_exports, {
  UpdatePaymentUseCase: () => UpdatePaymentUseCase
});
module.exports = __toCommonJS(update_payment_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UpdatePaymentUseCase
});
