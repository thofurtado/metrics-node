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

// src/use-cases/delete-item.ts
var delete_item_exports = {};
__export(delete_item_exports, {
  DeleteItemUseCase: () => DeleteItemUseCase
});
module.exports = __toCommonJS(delete_item_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/delete-item.ts
var DeleteItemUseCase = class {
  constructor(itemsRepository, stocksRepository) {
    this.itemsRepository = itemsRepository;
    this.stocksRepository = stocksRepository;
  }
  async execute({ itemId }) {
    const item = await this.itemsRepository.findById(itemId);
    if (!item) {
      throw new ResourceNotFoundError();
    }
    const stockHistory = await this.stocksRepository.getItemHistory(itemId);
    if (stockHistory && stockHistory.length > 0) {
      throw new Error("Cannot delete item with stock history. Archive it instead.");
    }
    await this.itemsRepository.remove(itemId);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DeleteItemUseCase
});
