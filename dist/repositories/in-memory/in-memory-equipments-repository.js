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

// src/repositories/in-memory/in-memory-equipments-repository.ts
var in_memory_equipments_repository_exports = {};
__export(in_memory_equipments_repository_exports, {
  InMemoryEquipmentsRepository: () => InMemoryEquipmentsRepository
});
module.exports = __toCommonJS(in_memory_equipments_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryEquipmentsRepository = class {
  constructor() {
    this.items = [];
  }
  async findByClient(client_id) {
    const equipments = this.items.filter((item) => item.client_id === client_id);
    return equipments.length ? equipments : null;
  }
  async findMany(type, brand, identification) {
    let filteredEquipments = this.items.slice();
    if (type !== void 0) {
      filteredEquipments = filteredEquipments.filter((item) => item.type === type);
    }
    if (brand !== void 0) {
      filteredEquipments = filteredEquipments.filter((item) => item.brand === brand);
    }
    if (identification !== void 0) {
      filteredEquipments = filteredEquipments.filter((item) => item.identification === identification);
    }
    return filteredEquipments.length ? filteredEquipments : null;
  }
  async findById(id) {
    const equipment = this.items.find((item) => item.id === id);
    if (!equipment) {
      return null;
    }
    return equipment;
  }
  async findByClientId(client_id) {
    const equipment = this.items.filter((item) => item.client_id === client_id);
    if (!equipment) {
      return null;
    }
    return equipment;
  }
  async create(data) {
    const equipment = {
      id: (0, import_node_crypto.randomUUID)(),
      client_id: data.client_id,
      type: data.type,
      brand: data.brand ?? null,
      identification: data.identification ?? null,
      details: data.details ?? null,
      entry: new Date(data.entry)
    };
    this.items.push(equipment);
    return equipment;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryEquipmentsRepository
});
