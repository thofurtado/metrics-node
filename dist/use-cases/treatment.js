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

// src/use-cases/treatment.ts
var treatment_exports = {};
__export(treatment_exports, {
  TreatmentUseCase: () => TreatmentUseCase
});
module.exports = __toCommonJS(treatment_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/treatment.ts
var TreatmentUseCase = class {
  constructor(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository) {
    this.treatmentsRepository = treatmentsRepository;
    this.clientsRepository = clientsRepository;
    this.equipmentsRepository = equipmentsRepository;
    this.usersRepository = usersRepository;
  }
  async execute({
    opening_date,
    contact,
    client_id,
    equipment_id,
    user_id,
    request,
    status,
    amount,
    observations,
    ending_date
  }) {
    let user;
    if (user_id) {
      user = await this.usersRepository.findById(user_id);
      if (!user)
        throw new ResourceNotFoundError();
    }
    let client;
    if (client_id) {
      client = await this.clientsRepository.findById(client_id);
      if (!client)
        throw new ResourceNotFoundError();
    }
    let equipment;
    if (equipment_id) {
      equipment = await this.equipmentsRepository.findById(equipment_id);
      if (!equipment)
        throw new ResourceNotFoundError();
    }
    const treatment = await this.treatmentsRepository.create({
      opening_date,
      contact,
      client_id,
      equipment_id,
      request,
      status,
      amount,
      observations,
      ending_date
    });
    return {
      treatment
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TreatmentUseCase
});
