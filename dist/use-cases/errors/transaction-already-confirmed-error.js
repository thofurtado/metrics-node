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

// src/use-cases/errors/transaction-already-confirmed-error.ts
var transaction_already_confirmed_error_exports = {};
__export(transaction_already_confirmed_error_exports, {
  TransactionAlreadyConfirmedError: () => TransactionAlreadyConfirmedError
});
module.exports = __toCommonJS(transaction_already_confirmed_error_exports);
var TransactionAlreadyConfirmedError = class extends Error {
  constructor() {
    super("Transaction is already confirmed and cannot be changed.");
    this.name = "TransactionAlreadyConfirmedError";
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TransactionAlreadyConfirmedError
});
