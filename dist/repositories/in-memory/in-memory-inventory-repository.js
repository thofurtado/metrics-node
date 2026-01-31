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

// src/repositories/in-memory/in-memory-inventory-repository.ts
var in_memory_inventory_repository_exports = {};
__export(in_memory_inventory_repository_exports, {
  InMemoryInventoryRepository: () => InMemoryInventoryRepository
});
module.exports = __toCommonJS(in_memory_inventory_repository_exports);
var InMemoryInventoryRepository = class {
  constructor() {
    this.items = [];
    this.treatments = [];
    this.treatmentItems = [];
  }
  async getInventorySummary() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const patrimony = this.items.reduce((sum, item) => {
      if (item.isItem && item.active !== false) {
        const itemStock = item.stock || 0;
        const itemCost = item.cost || 0;
        return sum + itemStock * itemCost;
      }
      return sum;
    }, 0);
    const monthTreatmentItems = this.treatmentItems.filter((treatmentItem) => {
      const treatment = this.treatments.find((t) => t.id === treatmentItem.treatment_id);
      if (!treatment) return false;
      const treatmentDate = new Date(treatment.opening_date);
      return treatmentDate >= startOfMonth && treatmentDate < startOfNextMonth;
    });
    const productsSoldValue = monthTreatmentItems.reduce((sum, treatmentItem) => {
      const item = this.items.find((i) => i.id === treatmentItem.item_id);
      if (item?.isItem) {
        const quantity = treatmentItem.quantity || 0;
        const salesValue = treatmentItem.salesValue || item.price || 0;
        return sum + quantity * salesValue;
      }
      return sum;
    }, 0);
    const servicesSoldValue = monthTreatmentItems.reduce((sum, treatmentItem) => {
      const item = this.items.find((i) => i.id === treatmentItem.item_id);
      if (item && item.isItem === false) {
        const quantity = treatmentItem.quantity || 0;
        const salesValue = treatmentItem.salesValue || item.price || 0;
        return sum + quantity * salesValue;
      }
      return sum;
    }, 0);
    return {
      patrimony,
      productsSold: productsSoldValue,
      servicesSold: servicesSoldValue
    };
  }
  // Métodos auxiliares para testes
  createItem(item) {
    const newItem = {
      id: item.id || `item-${this.items.length + 1}`,
      name: item.name || "Default Item",
      description: item.description || null,
      cost: item.cost || 0,
      price: item.price || 0,
      stock: item.stock || 0,
      active: item.active !== void 0 ? item.active : true,
      isItem: item.isItem !== void 0 ? item.isItem : true,
      ...item
    };
    this.items.push(newItem);
    return newItem;
  }
  createTreatment(treatment) {
    const newTreatment = {
      id: treatment.id || `treatment-${this.treatments.length + 1}`,
      opening_date: treatment.opening_date || /* @__PURE__ */ new Date(),
      ending_date: treatment.ending_date || null,
      contact: treatment.contact || null,
      user_id: treatment.user_id || null,
      client_id: treatment.client_id || null,
      equipment_id: treatment.equipment_id || null,
      request: treatment.request || "Default request",
      status: treatment.status || "pending",
      amount: treatment.amount || 0,
      observations: treatment.observations || null,
      ...treatment
    };
    this.treatments.push(newTreatment);
    return newTreatment;
  }
  createTreatmentItem(treatmentItem) {
    const newTreatmentItem = {
      id: treatmentItem.id || `treatment-item-${this.treatmentItems.length + 1}`,
      item_id: treatmentItem.item_id || "item-1",
      treatment_id: treatmentItem.treatment_id || "treatment-1",
      stock_id: treatmentItem.stock_id || null,
      quantity: treatmentItem.quantity || 0,
      salesValue: treatmentItem.salesValue || null,
      discount: treatmentItem.discount || null,
      ...treatmentItem
    };
    this.treatmentItems.push(newTreatmentItem);
    return newTreatmentItem;
  }
  // Métodos auxiliares adicionais para limpar dados entre testes
  clearItems() {
    this.items = [];
  }
  clearTreatments() {
    this.treatments = [];
  }
  clearTreatmentItems() {
    this.treatmentItems = [];
  }
  clearAll() {
    this.clearItems();
    this.clearTreatments();
    this.clearTreatmentItems();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryInventoryRepository
});
