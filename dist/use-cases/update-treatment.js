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

// src/use-cases/update-treatment.ts
var update_treatment_exports = {};
__export(update_treatment_exports, {
  UpdateTreatmentUseCase: () => UpdateTreatmentUseCase
});
module.exports = __toCommonJS(update_treatment_exports);
var UpdateTreatmentUseCase = class {
  constructor(treatmentsRepository) {
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    id,
    opening_date,
    ending_date,
    contact,
    user_id,
    client_id,
    equipment_id,
    request,
    status,
    observations
  }) {
    const treatment = await this.treatmentsRepository.update(id, {
      opening_date,
      ending_date,
      contact,
      user_id,
      client_id,
      equipment_id,
      request,
      status,
      observations
    });
    return {
      treatment
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UpdateTreatmentUseCase
});
