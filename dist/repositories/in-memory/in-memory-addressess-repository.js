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

// src/repositories/in-memory/in-memory-addressess-repository.ts
var in_memory_addressess_repository_exports = {};
__export(in_memory_addressess_repository_exports, {
  InMemoryAddressessRepository: () => InMemoryAddressessRepository
});
module.exports = __toCommonJS(in_memory_addressess_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryAddressessRepository = class {
  constructor() {
    this.items = [];
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async findByClient(client_id) {
    const addresses = this.items.filter((item) => item.client_id === client_id);
    return addresses.length ? addresses : null;
  }
  async findByDetails(neighborhood, city) {
    let filteredAddresses = this.items.slice();
    if (neighborhood) {
      filteredAddresses = filteredAddresses.filter((item) => item.neighborhood === neighborhood);
    }
    if (city) {
      filteredAddresses = filteredAddresses.filter((item) => item.city === city);
    }
    return filteredAddresses.length ? filteredAddresses : null;
  }
  async findByClientId(client_id) {
    const address = this.items.find((item) => item.client_id === client_id);
    if (!address) {
      return null;
    }
    return address;
  }
  async create(data) {
    const address = {
      id: (0, import_node_crypto.randomUUID)(),
      street: data.street,
      number: data.number,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      zipcode: data.zipcode ?? null,
      client_id: data.client_id
    };
    this.items.push(address);
    return address;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryAddressessRepository
});
