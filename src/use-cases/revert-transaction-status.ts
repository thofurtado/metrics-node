import { TransactionsRepository } from "@/repositories/transactions-repository";
import { ResourceNotFoundError } from "./errors/resource-not-found-error";

interface RevertTransactionStatusRequest {
    id: string;
}

export class RevertTransactionStatusUseCase {
    constructor(private transactionsRepository: TransactionsRepository) { }

    async execute({ id }: RevertTransactionStatusRequest): Promise<void> {
        // Validation could be added here (e.g., check for reconciliation lock)
        // For now, relies on Repository for existence check.

        await this.transactionsRepository.revertTransactionStatus(id);
    }
}
