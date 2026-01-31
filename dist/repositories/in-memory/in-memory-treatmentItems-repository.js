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

// src/repositories/in-memory/in-memory-treatmentItems-repository.ts
var in_memory_treatmentItems_repository_exports = {};
__export(in_memory_treatmentItems_repository_exports, {
  InMemoryTreatmentItemsRepository: () => InMemoryTreatmentItemsRepository
});
module.exports = __toCommonJS(in_memory_treatmentItems_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryTreatmentItemsRepository = class {
  constructor() {
    this.items = [];
  }
  async remove(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    } else {
      throw new Error(`Treatment item with ID ${id} not found`);
    }
  }
  async findById(id) {
    const foundItem = this.items.find((item) => item.id === id);
    return foundItem ? { ...foundItem } : null;
  }
  async create(data) {
    const treatmentItem = {
      id: (0, import_node_crypto.randomUUID)(),
      item_id: data.item_id,
      treatment_id: data.treatment_id,
      stock_id: data.stock_id || null,
      quantity: data.quantity,
      salesValue: data.salesValue || null
    };
    this.items.push(treatmentItem);
    return treatmentItem;
  }
  async findByTreatment(treatment_id) {
    const treatmentItems = this.items.filter((item) => item.treatment_id === treatment_id);
    return treatmentItems.length ? treatmentItems : null;
  }
  async linkStock(id, stock_id) {
    const index = this.items.findIndex((item) => item.id === id);
    this.items[index].stock_id = stock_id;
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    } else {
      throw new Error(`Treatment item with ID ${id} not found`);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryTreatmentItemsRepository
});
