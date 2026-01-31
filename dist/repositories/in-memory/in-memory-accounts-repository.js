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

// src/repositories/in-memory/in-memory-accounts-repository.ts
var in_memory_accounts_repository_exports = {};
__export(in_memory_accounts_repository_exports, {
  InMemoryAccountsRepository: () => InMemoryAccountsRepository
});
module.exports = __toCommonJS(in_memory_accounts_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryAccountsRepository = class {
  constructor() {
    this.items = [];
  }
  async findMany() {
    const accounts = this.items;
    return accounts;
  }
  async changeBalance(id, value, isIncome) {
    const account = await this.findById(id);
    if (account) {
      isIncome ? account.balance += value : account.balance -= value;
      return true;
    }
    return false;
  }
  async findByName(name) {
    const account = this.items.find((item) => item.name === name);
    if (!account) {
      return null;
    }
    return account;
  }
  async findById(id) {
    const account = this.items.find((item) => item.id === id);
    if (!account) {
      return null;
    }
    return account;
  }
  async create(data) {
    const account = {
      id: (0, import_node_crypto.randomUUID)(),
      name: data.name,
      description: data.description ?? null,
      goal: data.goal ? Number(data.goal) : null,
      balance: data.balance
    };
    this.items.push(account);
    return account;
  }
  async update(id, data) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    const account = this.items[index];
    const updatedAccount = {
      ...account,
      ...data
    };
    this.items[index] = updatedAccount;
    return updatedAccount;
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryAccountsRepository
});
