import { GetTransactionsUseCase } from "./src/modules/financial/use-cases/get-transactions";
import { PrismaTransactionsRepository } from "./src/modules/financial/repositories/prisma/prisma-transactions-repository";

async function run() {
    try {
        const repo = new PrismaTransactionsRepository();
        const usecase = new GetTransactionsUseCase(repo);
        const r = await usecase.execute({ pageIndex: 1, month: new Date() });
        console.log("OK, total:", r?.transactions.length);
    } catch (e: any) {
        console.error("ERRO NO GET TRANSACTIONS:", e.message, e);
    }
}
run();
