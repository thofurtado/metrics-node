const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.transaction.aggregate({
        _count: { _all: true },
        _sum: { amount: true },
        where: {
            account_id: '36a7075a-16d6-4a31-9eca-2e699564aeb6',
            date: {
                gte: new Date('2026-02-01'),
                lte: new Date('2026-03-31')
            }
        }
    });
    console.log(JSON.stringify(res));
}
main().finally(() => prisma.$disconnect());
