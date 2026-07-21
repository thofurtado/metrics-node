import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public",
});
const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432";

async function main() {
    console.log("Fetching all tenants...");
    const result = await pool.query('SELECT "dbName", "domain" FROM "Tenant" WHERE status = $1', ['active']);
    
    for (const row of result.rows) {
        const { dbName, domain } = row;
        console.log(`\n===========================================`);
        console.log(`Processing Tenant: ${domain} (DB: ${dbName})`);
        
        const tenantUrl = `${baseUrl}/${dbName}?schema=public`;
        const prisma = new PrismaClient({
            datasources: { db: { url: tenantUrl } }
        });

        try {
            const accounts = await prisma.account.findMany();
            console.log(`Found ${accounts.length} accounts.`);

            for (const acc of accounts) {
                // Determine initial balance from first adjustment, or assume 0 if none
                const adjustments = await prisma.accountAdjustment.findMany({
                    where: { account_id: acc.id },
                    orderBy: { created_at: 'asc' }
                });

                let initialBalance = 0;
                // If there are manual adjustments, should we trust the LATEST adjustment?
                // Actually, the most robust way is to just find ALL confirmed transactions.
                // Wait, if they made adjustments to fix the balance, we might ruin it.
                // Let's just calculate the pure transaction sum and see the diff.
                
                const txs = await prisma.transaction.findMany({
                    where: { account_id: acc.id, confirmed: true }
                });

                let txSum = 0;
                for (const tx of txs) {
                    const amt = tx.totalValue ?? tx.amount;
                    if (tx.operation === 'income') txSum += amt;
                    else if (tx.operation === 'expense') txSum -= amt;
                }

                console.log(`Account ${acc.name}:`);
                console.log(`  Current Balance: ${acc.balance}`);
                console.log(`  Pure Transactions Sum: ${txSum}`);
                
                if (adjustments.length > 0) {
                    const lastAdj = adjustments[adjustments.length - 1];
                    console.log(`  Latest Adjustment: ${lastAdj.new_balance} (on ${lastAdj.created_at})`);
                }
            }
        } catch (e: any) {
            console.error(`Error processing tenant ${domain}: ${e.message}`);
        } finally {
            await prisma.$disconnect();
        }
    }
    
    await pool.end();
}

main().catch(console.error);
