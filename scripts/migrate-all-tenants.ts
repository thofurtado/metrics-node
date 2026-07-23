import { Pool } from 'pg';
import { execSync } from 'child_process';
import 'dotenv/config';

async function sendDiscordNotification(webhookUrl: string, total: int, successes: number, failures: any[]) {
  let content = `🚀 **Deploy de Migrações Finalizado!**\n\n`;
  content += `📦 **Total de Bancos:** ${total}\n`;
  content += `✅ **Sucessos:** ${successes}\n`;
  content += `❌ **Falhas:** ${failures.length}\n\n`;

  if (failures.length > 0) {
    content += `**Detalhes das Falhas:**\n`;
    failures.forEach(f => {
      content += `- **Banco:** \`${f.dbName}\` (Domínio: ${f.domain})\n  **Erro:** \`${f.errorSnippet}\`\n`;
    });
  } else {
    content += `🎉 Todos os tenants foram atualizados com sucesso!`;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    console.log('📡 Notificação enviada para o Discord com sucesso.');
  } catch (error) {
    console.error('⚠️ Falha ao enviar notificação para o Discord:', error);
  }
}

async function migrateAllTenants() {
  console.log('🚀 Iniciando processo de migração Multi-Tenant com Auditoria e Alertas...');

  const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public";
  const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432";
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

  const pool = new Pool({ connectionString: masterUrl });

  try {
    // 1. Cria a tabela de log no master caso não exista
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "TenantMigrationLog" (
        "id" SERIAL PRIMARY KEY,
        "tenantDbName" VARCHAR(255) NOT NULL,
        "domain" VARCHAR(255) NOT NULL,
        "status" VARCHAR(50) NOT NULL,
        "errorLog" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Busca todos os bancos de dados dos clientes ativos
    const result = await pool.query('SELECT "dbName", domain FROM "Tenant" WHERE status = $1', ['active']);
    const tenants = result.rows;

    if (tenants.length === 0) {
      console.log('⚠️ Nenhum tenant ativo encontrado.');
      return;
    }

    console.log(`📦 Encontrados ${tenants.length} tenants ativos. Aplicando migrações...\n`);

    let successes = 0;
    const failures: any[] = [];

    // 3. Loop de migração por cliente
    for (const tenant of tenants) {
      const { dbName, domain } = tenant;
      const tenantUrl = `${baseUrl}/${dbName}?schema=public`;

      console.log(`-------------------------------------------------`);
      console.log(`🔄 Aplicando migrações no banco: ${dbName} (Domínio: ${domain})`);
      
      try {
        // Executa o prisma migrate deploy capturando stdout/stderr
        const output = execSync('npx prisma migrate deploy', {
          env: {
            ...process.env,
            DATABASE_URL: tenantUrl,
          },
          stdio: 'pipe' // Captura para o log do banco
        });
        
        console.log(`✅ Sucesso no banco ${dbName}!`);
        successes++;

        // Grava no Master como Sucesso
        await pool.query(
          'INSERT INTO "TenantMigrationLog" ("tenantDbName", "domain", "status", "errorLog") VALUES ($1, $2, $3, $4)',
          [dbName, domain, 'SUCCESS', output.toString()]
        );

      } catch (error: any) {
        const errorMsg = error.stderr ? error.stderr.toString() : error.message;
        console.error(`❌ Falha ao aplicar migração no banco ${dbName}.`);
        console.error(errorMsg);

        failures.push({
          dbName,
          domain,
          errorSnippet: errorMsg.substring(0, 200).replace(/\n/g, ' ') // Pega um trecho curto pro discord
        });

        // Grava no Master como Falha
        await pool.query(
          'INSERT INTO "TenantMigrationLog" ("tenantDbName", "domain", "status", "errorLog") VALUES ($1, $2, $3, $4)',
          [dbName, domain, 'FAILED', errorMsg]
        );
      }
    }

    console.log(`\n🎉 Migrações concluídas! Sucessos: ${successes} | Falhas: ${failures.length}`);

    // 4. Dispara Notificação no Discord se o Webhook estiver configurado
    if (discordWebhook) {
      await sendDiscordNotification(discordWebhook, tenants.length, successes, failures);
    } else {
      console.log('ℹ️ Variável DISCORD_WEBHOOK_URL não configurada. Pulo de notificação ignorado.');
    }

  } catch (error) {
    console.error('❌ Erro Fatal no Gerenciador de Migrações:', error);
  } finally {
    await pool.end();
  }
}

migrateAllTenants();
