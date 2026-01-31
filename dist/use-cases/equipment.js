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

// src/use-cases/equipment.ts
var equipment_exports = {};
__export(equipment_exports, {
  EquipmentUseCase: () => EquipmentUseCase
});
module.exports = __toCommonJS(equipment_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/equipment.ts
var EquipmentUseCase = class {
  constructor(equipmentRepository, clientRepository) {
    this.equipmentRepository = equipmentRepository;
    this.clientRepository = clientRepository;
  }
  async execute({
    type,
    brand,
    identification,
    details,
    entry,
    client_id
  }) {
    const client = await this.clientRepository.findById(client_id);
    if (!client) {
      throw new ResourceNotFoundError();
    }
    const equipment = await this.equipmentRepository.create({
      type,
      brand: brand || null,
      identification: identification || null,
      details: details || null,
      entry: new Date(entry),
      client_id
    });
    return {
      equipment
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EquipmentUseCase
});
