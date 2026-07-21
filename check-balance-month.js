import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const startOfMonth = new Date(2026, 6, 1); // July 2026 (month is 0-indexed in JS)
    const startOfNextMonth = new Date(2026, 7, 1);

    const monthlyTxs = await prisma.transaction.findMany({
        where: {
            data_vencimento: { gte: startOfMonth, lt: startOfNextMonth }
        }
    });

    let incPaid = 0, incUnpaid = 0;
    let expPaid = 0, expUnpaid = 0;

    for (const tx of monthlyTxs) {
        if (tx.operation === 'income') {
            if (tx.confirmed) incPaid += (tx.totalValue ?? tx.amount);
            else incUnpaid += tx.amount;
        } else if (tx.operation === 'expense') {
            if (tx.confirmed) expPaid += (tx.totalValue ?? tx.amount);
            else expUnpaid += tx.amount;
        }
    }
    console.log(`Month: July 2026`);
    console.log(`Incomes Paid: ${incPaid}`);
    console.log(`Incomes Unpaid: ${incUnpaid}`);
    console.log(`Expenses Paid: ${expPaid}`);
    console.log(`Expenses Unpaid: ${expUnpaid}`);
    
    // total balance
    const accounts = await prisma.account.findMany();
    let totalBal = 0;
    for (const acc of accounts) totalBal += acc.balance;
    console.log(`\nTotal Balance: ${totalBal}`);
    console.log(`General Balance (monthlyIncome): ${incPaid + incUnpaid}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
