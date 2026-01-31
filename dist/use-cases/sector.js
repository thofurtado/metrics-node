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

// src/use-cases/sector.ts
var sector_exports = {};
__export(sector_exports, {
  SectorUseCase: () => SectorUseCase
});
module.exports = __toCommonJS(sector_exports);

// src/use-cases/errors/this-name-already-exists-error.ts
var ThisNameAlreadyExistsError = class extends Error {
  constructor() {
    super("Nome j\xE1 cadastrado");
  }
};

// src/use-cases/errors/invalid-option-error.ts
var InvalidOptionError = class extends Error {
  constructor() {
    super("Op\xE7\xE3o invalida");
  }
};

// src/use-cases/sector.ts
var SectorUseCase = class {
  constructor(sectorsRepository) {
    this.sectorsRepository = sectorsRepository;
  }
  async execute({
    name,
    budget,
    type
  }) {
    const sectorWithSameName = await this.sectorsRepository.findByName(name);
    if (sectorWithSameName !== null) {
      throw new ThisNameAlreadyExistsError();
    }
    if (type !== "in" && type !== "out") {
      throw new InvalidOptionError();
    }
    const sector = await this.sectorsRepository.create({
      name,
      budget,
      type
    });
    return {
      sector
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SectorUseCase
});
