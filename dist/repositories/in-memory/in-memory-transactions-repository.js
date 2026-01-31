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

// src/repositories/in-memory/in-memory-transactions-repository.ts
var in_memory_transactions_repository_exports = {};
__export(in_memory_transactions_repository_exports, {
  InMemoryTransactionsRepository: () => InMemoryTransactionsRepository
});
module.exports = __toCommonJS(in_memory_transactions_repository_exports);
var import_node_crypto = require("crypto");
var InMemoryTransactionsRepository = class {
  constructor() {
    this.items = [];
  }
  async getFinancialSummary() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const startOfToday = new Date(currentDate);
    startOfToday.setHours(0, 0, 0, 0);
    const currentMonthTransactions = this.items.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startOfMonth && transactionDate < startOfNextMonth;
    });
    const totalBalance = this.items.filter((t) => t.confirmed).reduce((sum, transaction) => {
      return transaction.operation === "income" ? sum + transaction.amount : sum - transaction.amount;
    }, 0);
    const monthlyIncome = currentMonthTransactions.filter((t) => t.operation === "income").reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpenses = currentMonthTransactions.filter((t) => t.operation === "expense").reduce((sum, t) => sum + t.amount, 0);
    const pendingIncome = currentMonthTransactions.filter((t) => t.operation === "income" && !t.confirmed).reduce((sum, t) => sum + t.amount, 0);
    const pendingExpenses = currentMonthTransactions.filter((t) => t.operation === "expense" && !t.confirmed).reduce((sum, t) => sum + t.amount, 0);
    const overdueIncome = this.items.filter((t) => t.operation === "income" && !t.confirmed && new Date(t.date) < startOfToday).reduce((sum, t) => sum + t.amount, 0);
    const overdueExpenses = this.items.filter((t) => t.operation === "expense" && !t.confirmed && new Date(t.date) < startOfToday).reduce((sum, t) => sum + t.amount, 0);
    return {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      pendingIncome,
      pendingExpenses,
      overdueIncome,
      overdueExpenses
    };
  }
  // CORREÇÃO: findMany com a assinatura correta
  async findMany(month, pageIndex, perPage, description, value, sector_id, account_id) {
    const year = month.getFullYear();
    const monthNumber = month.getMonth() + 1;
    let filteredTransactions = this.items.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= new Date(year, monthNumber - 1, 1) && transactionDate < new Date(year, monthNumber, 1);
    });
    if (sector_id && sector_id !== "all") {
      filteredTransactions = filteredTransactions.filter((t) => t.sector_id === sector_id);
    }
    if (account_id && account_id !== "all") {
      filteredTransactions = filteredTransactions.filter((t) => t.account_id === account_id);
    }
    if (description) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.description?.toLowerCase().includes(description.toLowerCase())
      );
    }
    if (value) {
      filteredTransactions = filteredTransactions.filter((t) => t.amount === value);
    }
    const take = perPage || 6;
    const skip = pageIndex ? (pageIndex - 1) * take : 0;
    const paginatedTransactions = filteredTransactions.slice(skip, skip + take);
    return {
      transactions: paginatedTransactions,
      totalCount: filteredTransactions.length,
      perPage: take,
      pageIndex: pageIndex || 1
    };
  }
  async update(data) {
    const index = this.items.findIndex((item) => item.id === data.id);
    if (index === -1) {
      throw new Error("Transaction not found");
    }
    const updateData = {
      operation: typeof data.operation === "string" ? data.operation : this.items[index].operation,
      amount: typeof data.amount === "number" ? data.amount : this.items[index].amount,
      account_id: typeof data.account_id === "string" ? data.account_id : this.items[index].account_id,
      date: data.date ? new Date(data.date) : this.items[index].date,
      sector_id: data.sector_id !== void 0 ? typeof data.sector_id === "string" ? data.sector_id : null : this.items[index].sector_id,
      description: data.description !== void 0 ? typeof data.description === "string" ? data.description : null : this.items[index].description,
      confirmed: typeof data.confirmed === "boolean" ? data.confirmed : this.items[index].confirmed
    };
    const transactionId = typeof data.id === "string" ? data.id : this.items[index].id;
    const updatedTransaction = {
      ...this.items[index],
      ...updateData,
      id: transactionId
      // Garantir que o ID seja string
    };
    this.items[index] = updatedTransaction;
    return {
      id: updatedTransaction.id,
      operation: updatedTransaction.operation,
      date: updatedTransaction.date,
      amount: updatedTransaction.amount,
      account_id: updatedTransaction.account_id,
      sector_id: updatedTransaction.sector_id,
      description: updatedTransaction.description,
      confirmed: updatedTransaction.confirmed
    };
  }
  async create(data) {
    const transaction = {
      id: data.id ? data.id : (0, import_node_crypto.randomUUID)(),
      operation: data.operation,
      amount: data.amount,
      account_id: data.account_id,
      date: data.date ? new Date(data.date) : /* @__PURE__ */ new Date(),
      sector_id: data.sector_id || null,
      description: data.description || null,
      confirmed: data.confirmed || false
    };
    this.items.push(transaction);
    return transaction;
  }
  async findById(id) {
    const transaction = this.items.find((item) => item.id === id);
    return transaction || null;
  }
  // Implementação dos outros métodos necessários para a interface
  async getBalance() {
    const confirmedTransactions = this.items.filter((t) => t.confirmed);
    return confirmedTransactions.reduce((sum, transaction) => {
      return transaction.operation === "income" ? sum + transaction.amount : sum - transaction.amount;
    }, 0);
  }
  async getMonthIncomeByDays() {
    const dailyIncomes = this.items.filter((t) => t.operation === "income").reduce((acc, transaction) => {
      const day = transaction.date.toISOString().substring(5, 10);
      acc[day] = (acc[day] || 0) + transaction.amount;
      return acc;
    }, {});
    return Object.entries(dailyIncomes).map(([day, revenue]) => ({
      day,
      revenue
    }));
  }
  async getMonthExpenseBySector() {
    const sectorExpenses = this.items.filter((t) => t.operation === "expense").reduce((acc, transaction) => {
      const sectorName = transaction.sector_id || "Sem setor";
      acc[sectorName] = (acc[sectorName] || 0) + transaction.amount;
      return acc;
    }, {});
    return Object.entries(sectorExpenses).map(([sector_name, amount]) => ({
      sector_name,
      amount: Number(amount.toFixed(2))
    }));
  }
  async getMonthExpenseAmount() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentMonthExpenses = this.items.filter((t) => {
      const transactionDate = new Date(t.date);
      return transactionDate >= new Date(currentYear, currentMonth, 1) && transactionDate < new Date(currentYear, currentMonth + 1, 1) && t.operation === "expense";
    });
    const monthExpenseAmount = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const alreadyPaid = currentMonthExpenses.filter((t) => t.confirmed).reduce((sum, t) => sum + t.amount, 0);
    return {
      monthExpenseAmount,
      alreadyPaid,
      diffFromLastMonth: 0
      // Simplificado para testes
    };
  }
  async getMonthIncomeAmount() {
    const currentDate = /* @__PURE__ */ new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentMonthIncomes = this.items.filter((t) => {
      const transactionDate = new Date(t.date);
      return transactionDate >= new Date(currentYear, currentMonth, 1) && transactionDate < new Date(currentYear, currentMonth + 1, 1) && t.operation === "income";
    });
    const monthIncomeAmount = currentMonthIncomes.reduce((sum, t) => sum + t.amount, 0);
    const alreadyPaid = currentMonthIncomes.filter((t) => t.confirmed).reduce((sum, t) => sum + t.amount, 0);
    return {
      monthIncomeAmount,
      alreadyPaid,
      diffFromLastMonth: 0
      // Simplificado para testes
    };
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }
  async changeTransactionStatus(data) {
    const transactionIndex = this.items.findIndex((item) => item.id === data.id);
    if (transactionIndex !== -1) {
      this.items[transactionIndex].confirmed = !this.items[transactionIndex].confirmed;
      this.items[transactionIndex].amount = data.amount;
      this.items[transactionIndex].date = data.date;
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryTransactionsRepository
});
