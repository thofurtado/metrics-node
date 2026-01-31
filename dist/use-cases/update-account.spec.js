"use strict";

// src/repositories/in-memory/in-memory-accounts-repository.ts
var import_node_crypto = require("crypto");
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
      id: (0, import_node_crypto.randomUUID)(),
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

// src/use-cases/update-account.ts
var UpdateAccountUseCase = class {
  constructor(accountsRepository2) {
    this.accountsRepository = accountsRepository2;
  }
  async execute({
    id,
    name,
    description,
    goal
  }) {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new ResourceNotFoundError();
    }
    const updatedAccount = await this.accountsRepository.update(id, {
      name,
      description,
      goal
      // Balance is NOT updated here to ensure integrity
    });
    if (!updatedAccount) {
      throw new ResourceNotFoundError();
    }
    return {
      account: updatedAccount
    };
  }
};

// src/use-cases/update-account.spec.ts
var accountsRepository;
var sut;
describe("Update Account Use Case", () => {
  beforeEach(() => {
    accountsRepository = new InMemoryAccountsRepository();
    sut = new UpdateAccountUseCase(accountsRepository);
  });
  it("should be able to update an account", async () => {
    const account = await accountsRepository.create({
      name: "Original Name",
      balance: 100,
      description: "Desc"
    });
    const { account: updatedAccount } = await sut.execute({
      id: account.id,
      name: "New Name"
    });
    expect(updatedAccount.name).toEqual("New Name");
    expect(updatedAccount.balance).toEqual(100);
  });
  it("should not be able to update a non-existing account", async () => {
    await expect(
      () => sut.execute({
        id: "non-existing-id",
        name: "New Name"
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
