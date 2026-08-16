import { Pool } from 'pg';
import { execSync } from 'child_process';
import 'dotenv/config';

async function resolveAllTenants() {
  console.log('🚀 Iniciando processo de ROLLBACK Multi-Tenant para a migração que falhou...');

  const masterUrl = process.env.MASTER_DATABASE_URL || "postgresql://postgres:T0p1nf0r!@localhost:5432/db_master?schema=public";
  const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432";
  
  const pool = new Pool({ connectionString: masterUrl });

  try {
    const result = await pool.query('SELECT "dbName", domain FROM "Tenant" WHERE status = $1', ['active']);
    const tenants = result.rows;

    if (tenants.length === 0) {
      console.log('⚠️ Nenhum tenant ativo encontrado.');
      return;
    }

    console.log(`📦 Encontrados ${tenants.length} tenants ativos. Resolvendo migrações...\n`);

    for (const tenant of tenants) {
      const { dbName, domain } = tenant;
      const tenantUrl = `${baseUrl}/${dbName}?schema=public`;

      console.log(`-------------------------------------------------`);
      console.log(`🔄 Resolvendo status de falha no banco: ${dbName} (Domínio: ${domain})`);
      
      try {
        const output = execSync('npx prisma migrate resolve --rolled-back 20260816000000_add_telemetry_fields', {
          env: {
            ...process.env,
            DATABASE_URL: tenantUrl,
          },
          stdio: 'inherit'
        });
        console.log(`✅ Sucesso ao marcar rollback no banco ${dbName}!`);
      } catch (error: any) {
        console.error(`❌ Falha ao tentar resolver o banco ${dbName}. Pode já estar resolvido ou não ter falhado.`);
      }
    }
    console.log(`\n🎉 Processo de rollback concluído!`);
  } catch (error) {
    console.error('❌ Erro Fatal no Gerenciador:', error);
  } finally {
    await pool.end();
  }
}

resolveAllTenants();