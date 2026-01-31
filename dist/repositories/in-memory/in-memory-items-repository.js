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

// src/repositories/in-memory/in-memory-items-repository.ts
var in_memory_items_repository_exports = {};
__export(in_memory_items_repository_exports, {
  InMemoryItemsRepository: () => InMemoryItemsRepository
});
module.exports = __toCommonJS(in_memory_items_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryItemsRepository = class {
  constructor() {
    this.items = [];
  }
  async update(data, tx) {
    const id = data.id;
    const index = this.items.findIndex((item2) => item2.id === id);
    if (index === -1) {
      throw new Error("Item not found.");
    }
    const item = this.items[index];
    const updatedItem = {
      ...item,
      ...data
    };
    this.items[index] = updatedItem;
    return updatedItem;
  }
  async create(data) {
    const item = {
      id: (0, import_node_crypto.randomUUID)(),
      name: data.name,
      description: data.description ? data.description : null,
      cost: data.cost,
      price: data.price,
      stock: data.stock !== void 0 && data.stock !== null ? data.stock : 0,
      min_stock: data.min_stock !== void 0 && data.min_stock !== null ? data.min_stock : 0,
      active: data.active !== void 0 && data.active !== null ? data.active : true,
      isItem: data.isItem !== void 0 && data.isItem !== null ? data.isItem : true,
      display_id: data.display_id || 1,
      barcode: data.barcode || null,
      category: data.category || null
    };
    this.items.push(item);
    return item;
  }
  async findByName(name, is_active) {
    let filteredItems = this.items.slice();
    if (is_active !== void 0) {
      filteredItems = filteredItems.filter((item) => item.active === is_active);
    }
    const lowercaseName = name.toLowerCase();
    filteredItems = filteredItems.filter((item) => item.name.toLowerCase().includes(lowercaseName));
    return filteredItems.length ? filteredItems : null;
  }
  async findById(id) {
    const item = this.items.find((item2) => item2.id === id);
    return item || null;
  }
  async findMany(is_active, is_product, pageIndex = 1, perPage = 20, name, display_id, below_min_stock) {
    let filteredItems = this.items.slice();
    if (is_active !== void 0) {
      filteredItems = filteredItems.filter((item) => item.active === is_active);
    }
    if (is_product !== void 0) {
      filteredItems = filteredItems.filter((item) => item.isItem === is_product);
    }
    if (name) {
      filteredItems = filteredItems.filter((item) => item.name.toLowerCase().includes(name.toLowerCase()));
    }
    if (display_id) {
      filteredItems = filteredItems.filter((item) => item.display_id === display_id);
    }
    const totalCount = filteredItems.length;
    const start = (pageIndex - 1) * perPage;
    const end = start + perPage;
    const paginatedItems = filteredItems.slice(start, end);
    if (paginatedItems.length === 0) return null;
    return {
      items: paginatedItems,
      meta: {
        totalCount,
        pageIndex,
        perPage
      }
    };
  }
  async remove(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    } else {
      throw new Error(`Item with ID ${id} not found`);
    }
  }
  async changeStock(id, stock, operationType, tx) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      const currentStock = this.items[index].stock ?? 0;
      if (operationType) {
        this.items[index].stock = currentStock + stock;
      } else {
        this.items[index].stock = currentStock - stock;
      }
    } else {
      throw new Error(`Item with ID ${id} not found`);
    }
  }
  async setActive(id, commutator) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items[index].active = commutator;
    } else {
      throw new Error(`Item with ID ${id} not found`);
    }
  }
  async findMaxDisplayId() {
    if (this.items.length === 0) {
      return 0;
    }
    const maxId = Math.max(...this.items.map((item) => item.display_id));
    return maxId;
  }
  async findNextAvailableDisplayId() {
    const maxId = await this.findMaxDisplayId();
    return maxId + 1;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryItemsRepository
});
