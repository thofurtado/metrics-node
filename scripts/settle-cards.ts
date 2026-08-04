import { Pool } from 'pg';
import { execSync } from 'child_process';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function processTenantSettlements(tenantUrl: string, dbName: string) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: tenantUrl
      }
    }
  });

  try {
    // Busca a conta transitória
    const transitAccount = await prisma.account.findFirst({
      where: { is_transit: true }
    });

    if (!transitAccount) {
        console.log(`[${dbName}] Nenhuma conta transitória encontrada. Pulando.`);
        return;
    }

    // Busca a conta padrão para destino
    const defaultAccount = await prisma.account.findFirst({
        where: { is_transit: false }
    });

    if (!defaultAccount) {
        console.log(`[${dbName}] Nenhuma conta principal encontrada. Pulando.`);
        return;
    }

    console.log(`[${dbName}] Processando liquidações da conta transitória: ${transitAccount.name}`);

    // Lógica futura: 
    // 1. Buscar transações de entrada não liquidadas na conta transitória.
    // 2. Calcular taxas baseadas no POSMachine (payment_method).
    // 3. Verificar se atingiu os 'dias' para liquidação.
    // 4. Gerar TransferTransaction (Expense Transitória -> Income Real).

  } catch (err) {
      console.error(`[${dbName}] Erro ao processar liquidações:`, err);
  } finally {
      await prisma.$disconnect();
  }
}

async function runSettlements() {
  console.log('🚀 Iniciando rotina de Liquidação Automática de Cartões Multi-Tenant...');

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

    for (const tenant of tenants) {
      const { dbName, domain } = tenant;
      const tenantUrl = `${baseUrl}/${dbName}?schema=public`;

      console.log(`-------------------------------------------------`);
      console.log(`🔄 Liquidando cartões no banco: ${dbName} (Domínio: ${domain})`);
      
      await processTenantSettlements(tenantUrl, dbName);
    }

  } catch (error) {
    console.error('❌ Erro Fatal no Cron de Liquidação:', error);
  } finally {
    await pool.end();
  }
}

runSettlements();
