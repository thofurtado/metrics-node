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

    // 1. Buscar transações de entrada não liquidadas na conta transitória.
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        account_id: transitAccount.id,
        confirmed: false,
        payment_method: {
          in: [
            'CREDITO', 'DEBITO', 'PIX', 'VOUCHER', 
            'crédito', 'débito', 'pix', 'voucher',
            'Crédito', 'Débito', 'Pix', 'Voucher',
            'Cartão de Crédito', 'Cartão de Débito',
            'cartão de crédito', 'cartão de débito',
            'Cartão de crédito', 'Cartão de débito'
          ]
        },
        data_vencimento: {
          lte: new Date()
        }
      }
    });

    if (pendingTransactions.length === 0) {
      console.log(`[${dbName}] Nenhuma transação pendente para liquidar.`);
      return;
    }

    for (const tx of pendingTransactions) {
      const destMatch = tx.description?.match(/\[DEST:\s*([^\]]+)\]/)
      const targetAccountId = destMatch ? destMatch[1] : defaultAccount.id

      const taxPercentage = tx.interest || 0;
      const machineName = tx.description?.split('-')[1]?.trim().split(' ')[0] || 'Desconhecida';
      const paymentMethodRaw = tx.payment_method || '';

      const grossAmount = tx.totalValue || tx.amount;
      const netAmount = tx.amount;
      const feeAmount = grossAmount - netAmount;

      console.log(`[${dbName}] Liquidando TX ${tx.id} (${machineName} - ${paymentMethodRaw}): Bruto R$${grossAmount}, Taxa R$${feeAmount}, Líquido R$${netAmount}`);

      const cleanDescription = tx.description?.replace(/\[DEST:\s*[^\]]+\]/, '').trim() || 'Liquidação'

      // Atualiza a própria transação movendo-a para a conta real
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { 
            confirmed: true,
            account_id: targetAccountId,
            description: `${cleanDescription} (Liquidado)`
        }
      });

      // Atualiza o saldo da conta destino com o valor LÍQUIDO (totalValue)
      await prisma.account.update({
          where: { id: targetAccountId },
          data: { balance: { increment: tx.totalValue || tx.amount } }
      })
    }

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
