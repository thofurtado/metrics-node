"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Iniciando script de correção financeira (Fevereiro 2026)...');
    const startOfFeb = new Date('2026-02-01T00:00:00Z');
    const endOfFeb = new Date('2026-02-28T23:59:59.999Z');
    // Precisamos buscar as transações inseridas no seed (operation=out, confirmadas=false no mes)
    const result = await prisma.transaction.updateMany({
        where: {
            operation: 'out',
            confirmed: false,
            date: {
                gte: startOfFeb,
                lte: endOfFeb
            }
        },
        data: {
            confirmed: true
        }
    });
    console.log(`\n✅ Correção financeira finalizada com sucesso! ${result.count} transações foram atualizadas para "PAID".`);
}
main()
    .catch((e) => {
    console.error('Falha ao rodar correção', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
