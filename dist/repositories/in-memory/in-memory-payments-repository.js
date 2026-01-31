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

// src/repositories/in-memory/in-memory-payments-repository.ts
var in_memory_payments_repository_exports = {};
__export(in_memory_payments_repository_exports, {
  InMemoryPaymentsRepository: () => InMemoryPaymentsRepository
});
module.exports = __toCommonJS(in_memory_payments_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryPaymentsRepository = class {
  constructor() {
    this.items = [];
  }
  async create(data) {
    const payment = {
      id: (0, import_node_crypto.randomUUID)(),
      name: data.name,
      installment_limit: data.installment_limit,
      in_sight: data.in_sight,
      account_id: data.account_id ? data.account_id : null
    };
    this.items.push(payment);
    return payment;
  }
  async update(id, data) {
    const index = this.items.findIndex((item) => item.id === id);
    const payment = this.items[index];
    const updatedPayment = { ...payment, ...data };
    this.items[index] = updatedPayment;
    return updatedPayment;
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }
  async findById(id) {
    const payment = this.items.find((item) => item.id === id);
    return payment || null;
  }
  async findByName(name) {
    const payment = this.items.find((item) => item.name === name);
    return payment || null;
  }
  async findMany() {
    return this.items;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryPaymentsRepository
});
