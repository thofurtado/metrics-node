"use strict";

// src/repositories/in-memory/in-memory-payments-repository.ts
var import_node_crypto = require("crypto");
var InMemoryPaymentsRepository = class {
  constructor() {
    this.items = [];
  }
  async create(data) {
    const payment = {
      id: (0, import_node_crypto.randomUUID)(),
      name: data.name,
      installment_limit: data.installment_limit,
      in_sight: data.in_sight,
      account_id: data.account_id ? data.account_id : null
    };
    this.items.push(payment);
    return payment;
  }
  async update(id, data) {
    const index = this.items.findIndex((item) => item.id === id);
    const payment = this.items[index];
    const updatedPayment = { ...payment, ...data };
    this.items[index] = updatedPayment;
    return updatedPayment;
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }
  async findById(id) {
    const payment = this.items.find((item) => item.id === id);
    return payment || null;
  }
  async findByName(name) {
    const payment = this.items.find((item) => item.name === name);
    return payment || null;
  }
  async findMany() {
    return this.items;
  }
};

// src/repositories/in-memory/in-memory-accounts-repository.ts
var import_node_crypto2 = require("crypto");
var InMemoryAccountsRepository = class {
  constructor() {
    this.items = [];
  }
  async findMany() {
    const accounts = this.items;
    return accounts;
  }
  async changeBalance(id, value, isIncome) {
    const account = await this.findById(id);
    if (account) {
      isIncome ? account.balance += value : account.balance -= value;
      return true;
    }
    return false;
  }
  async findByName(name) {
    const account = this.items.find((item) => item.name === name);
    if (!account) {
      return null;
    }
    return account;
  }
  async findById(id) {
    const account = this.items.find((item) => item.id === id);
    if (!account) {
      return null;
    }
    return account;
  }
  async create(data) {
    const account = {
      id: (0, import_node_crypto2.randomUUID)(),
      name: data.name,
      description: data.description ?? null,
      goal: data.goal ? Number(data.goal) : null,
      balance: data.balance
    };
    this.items.push(account);
    return account;
  }
  async update(id, data) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    const account = this.items[index];
    const updatedAccount = {
      ...account,
      ...data
    };
    this.items[index] = updatedAccount;
    return updatedAccount;
  }
  async delete(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }
};

// src/use-cases/errors/resource-not-found-error.ts
var ResourceNotFoundError = class extends Error {
  constructor() {
    super("Recurso n\xE3o encontrado");
  }
};

// src/use-cases/update-payment.ts
var UpdatePaymentUseCase = class {
  constructor(paymentsRepository2, accountsRepository2) {
    this.paymentsRepository = paymentsRepository2;
    this.accountsRepository = accountsRepository2;
  }
  async execute({
    id,
    name,
    installment_limit,
    in_sight,
    account_id
  }) {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new ResourceNotFoundError();
    }
    if (account_id) {
      const account = await this.accountsRepository.findById(account_id);
      if (!account) {
        throw new ResourceNotFoundError();
      }
    }
    const updatedPayment = await this.paymentsRepository.update(id, {
      name,
      installment_limit,
      in_sight,
      account_id
    });
    return {
      payment: updatedPayment
    };
  }
};

// src/use-cases/update-payment.spec.ts
var paymentsRepository;
var accountsRepository;
var sut;
describe("Update Payment Use Case", () => {
  beforeEach(() => {
    paymentsRepository = new InMemoryPaymentsRepository();
    accountsRepository = new InMemoryAccountsRepository();
    sut = new UpdatePaymentUseCase(paymentsRepository, accountsRepository);
  });
  it("should be able to update a payment", async () => {
    const payment = await paymentsRepository.create({
      name: "Credit Card",
      installment_limit: 12,
      in_sight: false
    });
    const { payment: updatedPayment } = await sut.execute({
      id: payment.id,
      name: "Debit Card"
    });
    expect(updatedPayment.name).toEqual("Debit Card");
  });
  it("should not be able to update a non-existing payment", async () => {
    await expect(
      () => sut.execute({
        id: "non-existing-id",
        name: "New Name"
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
