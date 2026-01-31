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

// src/repositories/in-memory/in-memory-service-management-repository.ts
var in_memory_service_management_repository_exports = {};
__export(in_memory_service_management_repository_exports, {
  InMemoryServiceManagementRepository: () => InMemoryServiceManagementRepository
});
module.exports = __toCommonJS(in_memory_service_management_repository_exports);
var InMemoryServiceManagementRepository = class {
  constructor() {
    this.items = [];
  }
  async getServiceManagementData() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const now = currentDate.getTime();
    const monthTreatments = this.items.filter((treatment) => {
      const treatmentDate = new Date(treatment.opening_date);
      return treatmentDate >= startOfMonth && treatmentDate < startOfNextMonth;
    });
    const totalTreatments = monthTreatments.length;
    const completedTreatments = this.items.filter((t) => {
      if (t.status !== "resolved" || !t.ending_date) return false;
      const endingDate = new Date(t.ending_date);
      return endingDate >= startOfMonth && endingDate < startOfNextMonth;
    }).length;
    const inWorkbench = this.items.filter((t) => t.status === "in_workbench").length;
    const externalOpen = this.items.filter(
      (t) => ["pending", "in_progress", "follow_up"].includes(t.status)
    ).length;
    const averageTreatmentTime = this.calculateAverageTime(monthTreatments, now);
    return {
      totalTreatments,
      completedTreatments,
      inWorkbench,
      externalOpen,
      averageTreatmentTime
    };
  }
  calculateAverageTime(treatments, now) {
    if (treatments.length === 0) return 0;
    const totalTime = treatments.reduce((sum, treatment) => {
      const start = new Date(treatment.opening_date).getTime();
      const end = treatment.ending_date ? new Date(treatment.ending_date).getTime() : now;
      const durationInMinutes = (end - start) / (1e3 * 60);
      return sum + durationInMinutes;
    }, 0);
    return Math.round(totalTime / treatments.length);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryServiceManagementRepository
});
