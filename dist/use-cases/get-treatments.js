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

// src/use-cases/get-treatments.ts
var get_treatments_exports = {};
__export(get_treatments_exports, {
  GetTreatmentsUseCase: () => GetTreatmentsUseCase
});
module.exports = __toCommonJS(get_treatments_exports);
var GetTreatmentsUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({ pageIndex, perPage, treatmentId, clientName, status }) {
    if (!perPage)
      perPage = 6;
    try {
      const result = await this.treatmentsRepository.findByActive(pageIndex, perPage, treatmentId, clientName, status);
      return result;
    } catch (error) {
      console.error("[GetTreatmentsUseCase] Error executing repository query:", error);
      return null;
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GetTreatmentsUseCase
});
