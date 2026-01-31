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

// src/repositories/in-memory/in-memory-payment-entrys-repository.ts
var in_memory_payment_entrys_repository_exports = {};
__export(in_memory_payment_entrys_repository_exports, {
  InMemoryPaymentEntrysRepository: () => InMemoryPaymentEntrysRepository
});
module.exports = __toCommonJS(in_memory_payment_entrys_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryPaymentEntrysRepository = class {
  constructor() {
    this.items = [];
  }
  async create(data) {
    const paymentEntry = {
      id: (0, import_node_crypto.randomUUID)(),
      payment_id: data.payment_id,
      treatment_id: data.treatment_id,
      occurrences: data.occurrences,
      amount: data.amount
    };
    this.items.push(paymentEntry);
    return paymentEntry;
  }
  update(data) {
    throw new Error("Method not implemented.");
  }
  async findById(id) {
    const paymentEntry = this.items.find((item) => item.id === id);
    return paymentEntry || null;
  }
  async findMany() {
    const paymentEntrys = this.items.slice();
    return paymentEntrys || null;
  }
  async findByTreatmentId(treatmentId) {
    const entries = this.items.filter((item) => item.treatment_id === treatmentId);
    return entries;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryPaymentEntrysRepository
});
