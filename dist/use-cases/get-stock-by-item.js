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

// src/use-cases/get-stock-by-item.ts
var get_stock_by_item_exports = {};
__export(get_stock_by_item_exports, {
  GetStocksByItemUseCase: () => GetStocksByItemUseCase
});
module.exports = __toCommonJS(get_stock_by_item_exports);
var GetStocksByItemUseCase = class {
  constructor(stocksRepository) {
    this.stocksRepository = stocksRepository;
  }
  async execute({ item_id }) {
    const stocks = await this.stocksRepository.getItemHistory(item_id);
    return {
      stocks
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GetStocksByItemUseCase
});
