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

// src/repositories/in-memory/in-memory-balance-projection-repository.ts
var in_memory_balance_projection_repository_exports = {};
__export(in_memory_balance_projection_repository_exports, {
  InMemoryBalanceProjectionRepository: () => InMemoryBalanceProjectionRepository
});
module.exports = __toCommonJS(in_memory_balance_projection_repository_exports);
var InMemoryBalanceProjectionRepository = class {
  constructor() {
    this.accounts = [];
    this.transactions = [];
  }
  async getBalanceProjection(days = 30) {
    const currentDate = /* @__PURE__ */ new Date();
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const currentBalance = this.accounts.reduce((sum, account) => sum + account.balance, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const futureTransactions = this.transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= today && transactionDate <= endDate;
    });
    const dailyBalances = this.generateDailyBalances(
      currentBalance,
      today,
      endDate,
      futureTransactions
    );
    return {
      currentBalance,
      dailyBalances
    };
  }
  generateDailyBalances(initialBalance, startDate, endDate, transactions) {
    const dailyBalances = [];
    let runningBalance = initialBalance;
    const today = /* @__PURE__ */ new Date();
    const todayString = today.toISOString().split("T")[0];
    const todayTransactions = transactions.filter(
      (t) => new Date(t.date).toISOString().split("T")[0] === todayString
    );
    const todayBalanceChange = todayTransactions.reduce((sum, transaction) => {
      if (transaction.operation === "income") {
        return sum + transaction.amount;
      } else {
        return sum - transaction.amount;
      }
    }, 0);
    runningBalance += todayBalanceChange;
    dailyBalances.push({
      date: todayString,
      balance: runningBalance,
      isProjection: todayTransactions.some((t) => !t.confirmed)
    });
    const transactionsByDate = /* @__PURE__ */ new Map();
    transactions.forEach((transaction) => {
      const dateString = new Date(transaction.date).toISOString().split("T")[0];
      if (dateString !== todayString) {
        if (!transactionsByDate.has(dateString)) {
          transactionsByDate.set(dateString, []);
        }
        transactionsByDate.get(dateString).push(transaction);
      }
    });
    const uniqueDates = Array.from(transactionsByDate.keys()).sort();
    const limitedDates = uniqueDates.slice(0, 29);
    limitedDates.forEach((dateString) => {
      const dayTransactions = transactionsByDate.get(dateString) || [];
      const dayBalanceChange = dayTransactions.reduce((sum, transaction) => {
        if (transaction.operation === "income") {
          return sum + transaction.amount;
        } else {
          return sum - transaction.amount;
        }
      }, 0);
      runningBalance += dayBalanceChange;
      const date = new Date(dateString);
      const isFutureDate = date > today;
      const hasPendingTransactions = dayTransactions.some((t) => !t.confirmed);
      const isProjection = isFutureDate || hasPendingTransactions;
      dailyBalances.push({
        date: dateString,
        balance: runningBalance,
        isProjection
      });
    });
    return dailyBalances;
  }
  // Métodos auxiliares para testes
  createAccount(account) {
    const newAccount = {
      id: account.id || `account-${this.accounts.length + 1}`,
      name: account.name || "Default Account",
      description: account.description || null,
      balance: account.balance || 0,
      goal: account.goal || null,
      ...account
    };
    this.accounts.push(newAccount);
    return newAccount;
  }
  createTransaction(transaction) {
    const newTransaction = {
      id: transaction.id || `transaction-${this.transactions.length + 1}`,
      operation: transaction.operation || "income",
      date: transaction.date || /* @__PURE__ */ new Date(),
      amount: transaction.amount || 0,
      account_id: transaction.account_id || "account-1",
      sector_id: transaction.sector_id || null,
      description: transaction.description || null,
      confirmed: transaction.confirmed !== void 0 ? transaction.confirmed : true,
      ...transaction
    };
    this.transactions.push(newTransaction);
    return newTransaction;
  }
  clearAll() {
    this.accounts = [];
    this.transactions = [];
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryBalanceProjectionRepository
});
