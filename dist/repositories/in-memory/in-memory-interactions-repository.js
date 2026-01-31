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

// src/repositories/in-memory/in-memory-interactions-repository.ts
var in_memory_interactions_repository_exports = {};
__export(in_memory_interactions_repository_exports, {
  InMemoryInteractionsRepository: () => InMemoryInteractionsRepository
});
module.exports = __toCommonJS(in_memory_interactions_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryInteractionsRepository = class {
  constructor() {
    this.items = [];
  }
  async create(data) {
    const interaction = {
      id: (0, import_node_crypto.randomUUID)(),
      user_id: data.user_id,
      treatment_id: data.treatment_id,
      date: new Date(data.date) || /* @__PURE__ */ new Date(),
      description: data.description
    };
    this.items.push(interaction);
    return interaction;
  }
  async update(data) {
    const index = this.items.findIndex((item) => item.id === data.id);
    if (index !== -1) {
      const update = {
        description: data.description ? data.description : this.items[index].description,
        date: data.date ? new Date(data.date) : this.items[index].date
      };
      const interaction = this.items[index] = {
        ...this.items[index],
        ...update
      };
      return interaction;
    } else {
      throw new Error(`Interaction with ID ${data.id} not found`);
    }
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    } else {
      throw new Error(`Interaction with ID ${id} not found`);
    }
  }
  async findByTreatment(treatment_id) {
    const interactions = this.items.filter((item) => item.treatment_id === treatment_id);
    return interactions.length ? interactions : null;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryInteractionsRepository
});
