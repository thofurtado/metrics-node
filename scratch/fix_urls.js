const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_eureca"
        }
    }
});

async function run() {
    try {
        console.log("Conectando ao banco db_eureca...");
        const transaction = await prisma.transaction.findFirst({
            where: {
                attachment_url: {
                    not: null
                }
            }
        });
        console.log("Transação de exemplo:", transaction?.attachment_url);

        console.log("Atualizando transactions...");
        const tResult = await prisma.$executeRawUnsafe(`UPDATE transactions SET attachment_url = REPLACE(attachment_url, '/uploads/', '/uploads/db_eureca/') WHERE attachment_url LIKE '/uploads/%' AND attachment_url NOT LIKE '/uploads/db_eureca/%'`);
        console.log("Transações atualizadas:", tResult);

        console.log("Atualizando products...");
        const pResult = await prisma.$executeRawUnsafe(`UPDATE products SET image_url = REPLACE(image_url, '/uploads/', '/uploads/db_eureca/') WHERE image_url LIKE '/uploads/%' AND image_url NOT LIKE '/uploads/db_eureca/%'`);
        console.log("Produtos atualizados:", pResult);

        console.log("Concluído com sucesso!");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
