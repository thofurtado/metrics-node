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

// src/use-cases/interaction.ts
var interaction_exports = {};
__export(interaction_exports, {
  InteractionUseCase: () => InteractionUseCase
});
module.exports = __toCommonJS(interaction_exports);

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/interaction.ts
var InteractionUseCase = class {
  constructor(interactionsRepository, usersRepository, treatmentsRepository) {
    this.interactionsRepository = interactionsRepository;
    this.usersRepository = usersRepository;
    this.treatmentsRepository = treatmentsRepository;
  }
  async execute({
    user_id,
    treatment_id,
    date,
    description
  }) {
    const user = await this.usersRepository.findById(user_id);
    if (!user) {
      console.log("usuario n\xE3o encontrado");
      throw new ResourceNotFoundError();
    }
    const treatment = await this.treatmentsRepository.findById(treatment_id);
    if (!treatment) {
      console.log("atendimento n\xE3o encontrado");
      throw new ResourceNotFoundError();
    }
    const interaction = await this.interactionsRepository.create({
      user_id,
      treatment_id,
      date,
      description
    });
    return {
      interaction
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InteractionUseCase
});
