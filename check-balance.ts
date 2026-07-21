import { prisma } from './src/lib/prisma';

async function main() {
    const accounts = await prisma.account.findMany();
    console.log("--- ACCOUNTS ---");
    for (const acc of accounts) {
        console.log(`Account: ${acc.name} (ID: ${acc.id}) - Current Balance: ${acc.balance}`);
    }

    const txs = await prisma.transaction.findMany({
        where: { confirmed: true }
    });

    console.log("\n--- AGGREGATE PAID TXS ---");
    let totalIn = 0;
    let totalOut = 0;
    for (const tx of txs) {
        const amt = tx.totalValue ?? tx.amount;
        if (tx.operation === 'income') totalIn += amt;
        if (tx.operation === 'expense') totalOut += amt;
    }
    console.log(`Total Paid Incomes: ${totalIn}`);
    console.log(`Total Paid Expenses: ${totalOut}`);

    console.log("\n--- AGGREGATE UNPAID TXS ---");
    const unpaidTxs = await prisma.transaction.findMany({
        where: { confirmed: false }
    });
    let unpaidIn = 0;
    let unpaidOut = 0;
    for (const tx of unpaidTxs) {
        const amt = tx.amount;
        if (tx.operation === 'income') unpaidIn += amt;
        if (tx.operation === 'expense') unpaidOut += amt;
    }
    console.log(`Total Unpaid Incomes: ${unpaidIn}`);
    console.log(`Total Unpaid Expenses: ${unpaidOut}`);

}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
