const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_marujo"
        }
    }
});

async function run() {
    try {
        console.log("Conectando ao banco db_marujo...");
        
        console.log("Atualizando transactions...");
        const tResult = await prisma.$executeRawUnsafe(`UPDATE transactions SET attachment_url = REPLACE(attachment_url, '/uploads/', '/uploads/db_marujo/') WHERE attachment_url LIKE '/uploads/%' AND attachment_url NOT LIKE '/uploads/db_marujo/%'`);
        console.log("Transações atualizadas:", tResult);

        console.log("Atualizando products...");
        const pResult = await prisma.$executeRawUnsafe(`UPDATE products SET image_url = REPLACE(image_url, '/uploads/', '/uploads/db_marujo/') WHERE image_url LIKE '/uploads/%' AND image_url NOT LIKE '/uploads/db_marujo/%'`);
        console.log("Produtos atualizados:", pResult);

        console.log("Atualizando employees...");
        const eResult = await prisma.$executeRawUnsafe(`UPDATE employees SET photo_url = REPLACE(photo_url, '/uploads/', '/uploads/db_marujo/') WHERE photo_url LIKE '/uploads/%' AND photo_url NOT LIKE '/uploads/db_marujo/%'`);
        console.log("Funcionários atualizados:", eResult);

        console.log("Concluído com sucesso no db_marujo!");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
