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

// src/repositories/in-memory/in-memory-sectors-repository.ts
var in_memory_sectors_repository_exports = {};
__export(in_memory_sectors_repository_exports, {
  InMemorySectorsRepository: () => InMemorySectorsRepository
});
module.exports = __toCommonJS(in_memory_sectors_repository_exports);
var import_node_crypto = require("crypto");
var InMemorySectorsRepository = class {
  constructor() {
    this.items = [];
  }
  async findByName(name) {
    const sector = this.items.find((item) => item.name === name);
    if (!sector) {
      return null;
    }
    return sector;
  }
  async create(data) {
    const sector = {
      id: (0, import_node_crypto.randomUUID)(),
      name: data.name,
      budget: data.budget ?? null
    };
    this.items.push(sector);
    return sector;
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async findById(id) {
    const sector = this.items.find((item) => item.id === id);
    return sector || null;
  }
  async findMany() {
    const sectors = this.items;
    return sectors;
  }
  async compareBudget(month, sector_id) {
    throw new Error("Method not implemented.");
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemorySectorsRepository
});
