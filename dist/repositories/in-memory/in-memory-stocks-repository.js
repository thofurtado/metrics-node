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

// src/repositories/in-memory/in-memory-stocks-repository.ts
var in_memory_stocks_repository_exports = {};
__export(in_memory_stocks_repository_exports, {
  InMemoryStocksRepository: () => InMemoryStocksRepository
});
module.exports = __toCommonJS(in_memory_stocks_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryStocksRepository = class {
  constructor() {
    this.items = [];
  }
  async getItemBalance(item_id) {
    let inputQuantity = 0;
    let outputQuantity = 0;
    const itemStocks = this.items.filter((item) => item.item_id === item_id);
    if (itemStocks.length === 0) {
      throw new Error(`Item with ID ${item_id} not found`);
    }
    for (const stock of itemStocks) {
      if (stock.operation === "input") {
        inputQuantity += stock.quantity;
      } else if (stock.operation === "output") {
        outputQuantity += stock.quantity;
      }
    }
    const balance = inputQuantity - outputQuantity;
    return balance;
  }
  async create(data) {
    const stock = {
      id: (0, import_node_crypto.randomUUID)(),
      item_id: data.item_id,
      quantity: data.quantity,
      operation: data.operation,
      description: data.description || null,
      created_at: data.created_at ? new Date(data.created_at) : /* @__PURE__ */ new Date()
    };
    this.items.push(stock);
    return stock;
  }
  async getItemHistory(item_id, start_date, end_date) {
    const filteredStocks = this.items.filter((item) => item.item_id === item_id);
    if (!filteredStocks.length) {
      return null;
    }
    let history = filteredStocks;
    if (start_date && end_date) {
      history = history.filter((item) => {
        const stockDate = new Date(item.created_at);
        return stockDate >= start_date && stockDate <= end_date;
      });
    } else if (start_date) {
      history = history.filter((item) => new Date(item.created_at) >= start_date);
    } else if (end_date) {
      history = history.filter((item) => new Date(item.created_at) <= end_date);
    }
    return history;
  }
  update(data) {
    throw new Error("Method not implemented.");
  }
  delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    } else {
      throw new Error(`Interaction with ID ${id} not found`);
    }
  }
  async findById(id) {
    const stock = this.items.find((item) => item.id === id);
    return stock || null;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryStocksRepository
});
