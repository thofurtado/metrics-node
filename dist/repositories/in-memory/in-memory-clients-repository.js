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

// src/repositories/in-memory/in-memory-clients-repository.ts
var in_memory_clients_repository_exports = {};
__export(in_memory_clients_repository_exports, {
  InMemoryClientsRepository: () => InMemoryClientsRepository
});
module.exports = __toCommonJS(in_memory_clients_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryClientsRepository = class {
  constructor() {
    this.items = [];
  }
  async findByName(name) {
    const clients = this.items.filter((item) => item.name.toLowerCase().includes(name.toLowerCase()));
    return clients.length ? clients : null;
  }
  async findMany(is_contract) {
    let filteredClients = this.items.slice();
    if (is_contract !== void 0) {
      filteredClients = filteredClients.filter((item) => item.contract === is_contract);
    }
    return filteredClients.length ? filteredClients : null;
  }
  async update(data) {
    throw new Error("Method not implemented.");
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    } else {
      throw new Error(`Client with ID ${id} not found`);
    }
  }
  async findById(id) {
    const client = this.items.find((item) => item.id === id);
    if (!client) {
      return null;
    }
    return client;
  }
  async findByEmail(email) {
    const client = this.items.find((item) => item.email === email);
    if (!client) {
      return null;
    }
    return client;
  }
  async create(data) {
    const client = {
      id: (0, import_node_crypto.randomUUID)(),
      name: data.name,
      email: data.email,
      identification: data.identification,
      phone: data.phone ?? null,
      contract: data.contract ?? false
    };
    this.items.push(client);
    return client;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryClientsRepository
});
