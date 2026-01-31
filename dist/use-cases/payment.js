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

// src/use-cases/payment.ts
var payment_exports = {};
__export(payment_exports, {
  PaymentUseCase: () => PaymentUseCase
});
module.exports = __toCommonJS(payment_exports);

// src/use-cases/errors/this-name-already-exists-error.ts
var ThisNameAlreadyExistsError = class extends Error {
  constructor() {
    super("Nome j\xE1 cadastrado");
  }
};

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

// src/use-cases/payment.ts
var PaymentUseCase = class {
  constructor(paymentsRepository, accountsRepository) {
    this.paymentsRepository = paymentsRepository;
    this.accountsRepository = accountsRepository;
  }
  async execute({
    name,
    installment_limit,
    in_sight,
    account_id
  }) {
    const sameNamePayment = await this.paymentsRepository.findByName(name);
    if (sameNamePayment)
      throw new ThisNameAlreadyExistsError();
    if (installment_limit <= 0)
      throw new OnlyNaturalNumbersError();
    let findedAccount;
    if (account_id)
      findedAccount = await this.accountsRepository.findById(account_id);
    if (!findedAccount)
      throw new ResourceNotFoundError();
    const payment = await this.paymentsRepository.create({
      name,
      installment_limit,
      in_sight,
      account_id
    });
    return {
      payment
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PaymentUseCase
});
