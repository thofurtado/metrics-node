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

// src/use-cases/remove-treatment-item.ts
var remove_treatment_item_exports = {};
__export(remove_treatment_item_exports, {
  RemoveTreatmentItemUseCase: () => RemoveTreatmentItemUseCase
});
module.exports = __toCommonJS(remove_treatment_item_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/remove-treatment-item.ts
var RemoveTreatmentItemUseCase = class {
  constructor(treatmentItemsRepository, treatmentsRepository) {
    this.treatmentItemsRepository = treatmentItemsRepository;
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    id
  }) {
    const treatmentItem = await this.treatmentItemsRepository.findById(id);
    if (!treatmentItem) {
      throw new ResourceNotFoundError();
    } else {
      await this.treatmentItemsRepository.remove(id);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RemoveTreatmentItemUseCase
});
