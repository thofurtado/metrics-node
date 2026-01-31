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

// src/use-cases/treatmentItem.ts
var treatmentItem_exports = {};
__export(treatmentItem_exports, {
  TreatmentItemUseCase: () => TreatmentItemUseCase
});
module.exports = __toCommonJS(treatmentItem_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/errors/only-natural-numbers-error.ts
var OnlyNaturalNumbersError = class extends Error {
  constructor() {
    super("Apenas numeros naturais");
  }
};

// src/use-cases/errors/insufficient-stock-error.ts
var InsufficientStockError = class extends Error {
  constructor(message) {
    super(message || "Estoquel insuficiente.");
  }
};

// src/use-cases/treatmentItem.ts
var TreatmentItemUseCase = class {
  constructor(treatmentItemsRepository, treatmentsRepository, itemsRepository, stocksRepository) {
    this.treatmentItemsRepository = treatmentItemsRepository;
    this.treatmentsRepository = treatmentsRepository;
    this.itemsRepository = itemsRepository;
    this.stocksRepository = stocksRepository;
  }
  async execute({
    item_id,
    treatment_id,
    stock_id,
    quantity,
    salesValue,
    discount
  }) {
    let item;
    if (item_id) {
      item = await this.itemsRepository.findById(item_id);
      if (!item)
        throw new ResourceNotFoundError();
    }
    let treatment;
    if (treatment_id) {
      treatment = await this.treatmentsRepository.findById(treatment_id);
      if (!treatment)
        throw new ResourceNotFoundError();
    }
    let stock;
    if (stock_id) {
      stock = await this.stocksRepository.findById(stock_id);
      if (!stock)
        throw new ResourceNotFoundError();
    }
    if (quantity <= 0 || salesValue < 0)
      throw new OnlyNaturalNumbersError();
    const isService = !item?.isItem || item?.name?.toLowerCase().includes("clonagem") || item?.category?.toLowerCase().includes("servi");
    if (item && !isService && item.stock !== null && quantity > item.stock) {
      console.error(`[TreatmentItemUseCase] Stock Blocked: Item ${item.name} (isItem: ${item.isItem}), Stock: ${item.stock}, Req: ${quantity}`);
      throw new InsufficientStockError(`Estoque insuficiente. Dispon\xEDvel: ${item.stock}, Requisitado: ${quantity}`);
    }
    const treatmentItem = await this.treatmentItemsRepository.create({
      treatment_id,
      item_id,
      stock_id,
      quantity,
      salesValue,
      discount
    });
    return {
      treatmentItem
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TreatmentItemUseCase
});
