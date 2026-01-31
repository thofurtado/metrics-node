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

// src/repositories/in-memory/in-memory-treatments-repository.ts
var in_memory_treatments_repository_exports = {};
__export(in_memory_treatments_repository_exports, {
  InMemoryTreatmentsRepository: () => InMemoryTreatmentsRepository
});
module.exports = __toCommonJS(in_memory_treatments_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryTreatmentsRepository = class {
  constructor() {
    this.items = [];
  }
  async update(id, data) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("Treatment not found.");
    }
    const treatment = this.items[index];
    const updatedTreatment = {
      ...treatment,
      ...data
    };
    this.items[index] = updatedTreatment;
    return updatedTreatment;
  }
  async findByActive(pageIndex, perPage, treatmentId, clientName, status) {
    const activeTreatments = this.items.filter((treatment) => {
      return treatment.status === "pending" || treatment.status === "in_progress" || treatment.status === "on_hold" || treatment.status === "follow_up";
    });
    if (!activeTreatments.length) {
      return null;
    }
    return {
      treatments: activeTreatments,
      totalCount: activeTreatments.length,
      pageIndex: pageIndex || 1,
      perPage: perPage || 20
    };
  }
  async create(data) {
    const treatment = {
      id: (0, import_node_crypto.randomUUID)(),
      request: data.request,
      opening_date: data.opening_date ? new Date(data.opening_date) : /* @__PURE__ */ new Date(),
      ending_date: data.ending_date ? new Date(data.ending_date) : null,
      contact: data.contact || null,
      user_id: data.user_id || null,
      client_id: data.client_id || null,
      equipment_id: data.equipment_id || null,
      status: data.status || "pending",
      amount: data.amount || 0,
      observations: data.observations || null
    };
    this.items.push(treatment);
    return treatment;
  }
  async findByClient(client_id) {
    const treatments = this.items.filter((item) => item.client_id === client_id);
    return treatments.length ? treatments : null;
  }
  async findByStatus(status) {
    const treatments = this.items.filter((item) => item.status === status);
    return treatments.length ? treatments : null;
  }
  async close(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items[index].status = "resolved";
      this.items[index].ending_date = /* @__PURE__ */ new Date();
      return this.items[index];
    } else {
      throw new Error(`Treatment with ID ${id} not found`);
    }
  }
  async findById(id) {
    const treatment = this.items.find((item) => item.id === id);
    return treatment ? treatment : null;
  }
  async changeValue(id, value, entry) {
  }
  async getMonthTreatmentsAmount() {
    return { amount: 0, diffFromLastMonth: 0 };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryTreatmentsRepository
});
