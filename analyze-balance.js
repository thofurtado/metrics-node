import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // 1. Get all adjustments to see if initial balance is stored there
    const adjs = await prisma.accountAdjustment.findMany({
        orderBy: { created_at: 'asc' }
    });
    console.log(`Found ${adjs.length} account adjustments`);

    // 2. See accounts creation dates and balances
    const accounts = await prisma.account.findMany();
    for(const acc of accounts) {
        console.log(`Account ${acc.name} - Balance: ${acc.balance} - Created at: ${acc.created_at}`);
        
        // Find all paid txs for this account
        const txs = await prisma.transaction.findMany({
            where: { account_id: acc.id, confirmed: true }
        });

        let calculatedFromZero = 0;
        for(const tx of txs) {
            const amt = tx.totalValue ?? tx.amount;
            if(tx.operation === 'income') calculatedFromZero += amt;
            else if(tx.operation === 'expense') calculatedFromZero -= amt;
        }

        // Account adjustments for this account
        const accAdjs = adjs.filter(a => a.account_id === acc.id);
        
        console.log(`  -> Calculated from 0: ${calculatedFromZero}`);
        console.log(`  -> Diff (Current - Calculated): ${acc.balance - calculatedFromZero}`);
        if(accAdjs.length > 0) {
            console.log(`  -> Has ${accAdjs.length} adjustments. First prev_balance: ${accAdjs[0].previous_balance}`);
        }
    }
}
main().then(() => process.exit(0));
