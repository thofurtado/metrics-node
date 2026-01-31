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

// src/use-cases/get-inventory-summary.ts
var get_inventory_summary_exports = {};
__export(get_inventory_summary_exports, {
  GetInventorySummaryUseCase: () => GetInventorySummaryUseCase
});
module.exports = __toCommonJS(get_inventory_summary_exports);
var GetInventorySummaryUseCase = class {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }
  async execute() {
    const inventorySummary = await this.inventoryRepository.getInventorySummary();
    return { inventorySummary };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GetInventorySummaryUseCase
});
