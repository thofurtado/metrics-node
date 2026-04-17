const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixNullTotalValue() {
    const txs = await prisma.transaction.findMany({ 
        where: { confirmed: true, totalValue: null } 
    });
    console.log('Found ' + txs.length + ' transactions with null totalValue.');
    
    for (const tx of txs) { 
        await prisma.transaction.update({ 
            where: { id: tx.id }, 
            data: { totalValue: tx.amount } 
        }); 
    }
    
    console.log('All fixed.');
}

fixNullTotalValue()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    });
