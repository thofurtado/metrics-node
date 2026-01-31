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

// src/use-cases/update-profile.ts
var update_profile_exports = {};
__export(update_profile_exports, {
  UpdateProfileUseCase: () => UpdateProfileUseCase
});
module.exports = __toCommonJS(update_profile_exports);
var import_bcryptjs = require("bcryptjs");
var UpdateProfileUseCase = class {
  constructor(usersRepository) {
    this.usersRepository = usersRepository;
  }
  async execute({
    id,
    name,
    password,
    introduction
  }) {
    let password_hash;
    if (password)
      password_hash = await (0, import_bcryptjs.hash)(password, 6);
    const user = await this.usersRepository.update(id, {
      name,
      password_hash,
      introduction
    });
    return {
      user
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UpdateProfileUseCase
});
