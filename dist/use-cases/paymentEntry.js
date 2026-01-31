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

// src/use-cases/paymentEntry.ts
var paymentEntry_exports = {};
__export(paymentEntry_exports, {
  PaymentEntryUseCase: () => PaymentEntryUseCase
});
module.exports = __toCommonJS(paymentEntry_exports);

// src/use-cases/errors/only-natural-numbers-error.ts
var OnlyNaturalNumbersError = class extends Error {
  constructor() {
    super("Apenas numeros naturais");
  }
};

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/paymentEntry.ts
var PaymentEntryUseCase = class {
  constructor(paymentEntrysRepository, paymentRepository, treatmentRepository) {
    this.paymentEntrysRepository = paymentEntrysRepository;
    this.paymentRepository = paymentRepository;
    this.treatmentRepository = treatmentRepository;
  }
  async execute({
    payment_id,
    treatment_id,
    occurrences,
    amount
  }) {
    const payment = await this.paymentRepository.findById(payment_id);
    if (!payment)
      throw new ResourceNotFoundError();
    const treatment = await this.treatmentRepository.findById(treatment_id);
    if (!treatment)
      throw new ResourceNotFoundError();
    if (occurrences <= 0 || amount <= 0)
      throw new OnlyNaturalNumbersError();
    const paymentEntry = await this.paymentEntrysRepository.create({
      payment_id,
      treatment_id,
      occurrences,
      amount
    });
    return {
      paymentEntry
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PaymentEntryUseCase
});
