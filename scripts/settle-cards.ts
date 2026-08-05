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
        data_vencimento: {
          lte: new Date()
        }
      }
    });

    if (pendingTransactions.length === 0) {
      console.log(`[${dbName}] Nenhuma transação pendente para liquidar.`);
      return;
    }

    const posMachines = await prisma.pOSMachine.findMany({ include: { rates: true } });

    const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    for (const tx of pendingTransactions) {
      const paymentMethodRaw = tx.payment_method || '';
      
      let taxPercentage = 0;
      let machineName = '';

      // Tenta extrair o nome da máquina da descrição: 
      // Ex: "Caixa Almoço Operador 05/08/2026 - SAFRA Crédito"
      if (tx.description && tx.description.includes(' - ')) {
        const parts = tx.description.split(' - ');
        const afterDash = parts[parts.length - 1].trim(); 
        const cleanPaymentRaw = paymentMethodRaw.trim();
        if (cleanPaymentRaw) {
            const regex = new RegExp(cleanPaymentRaw, 'i');
            machineName = afterDash.replace(regex, '').trim();
        } else {
            machineName = afterDash;
        }
      }

      const matchedMachine = posMachines.find(m => m.name.toUpperCase() === machineName.toUpperCase());

      if (matchedMachine && matchedMachine.rates.length > 0) {
        const normPayment = normalizeString(paymentMethodRaw);
        const rate = matchedMachine.rates.find(r => normalizeString(r.payment_category).includes(normPayment));
        if (rate) {
          taxPercentage = rate.tax_percentage;
        }
      }

      const grossAmount = tx.amount;
      const feeAmount = (grossAmount * taxPercentage) / 100;
      const netAmount = grossAmount - feeAmount;

      console.log(`[${dbName}] Liquidando TX ${tx.id} (${machineName} - ${paymentMethodRaw}): Bruto R$${grossAmount}, Taxa R$${feeAmount}, Líquido R$${netAmount}`);

      // Atualiza a transação transitória como confirmada
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { confirmed: true }
      });

      // Cria a transação de destino na conta real (valor líquido)
      const destTx = await prisma.transaction.create({
        data: {
          operation: 'income',
          amount: netAmount,
          totalValue: netAmount,
          description: `Liquidação: ${tx.description}`,
          account_id: defaultAccount.id,
          confirmed: true,
          data_emissao: new Date(),
          data_vencimento: new Date(),
          payment_method: 'TRANSFERENCIA',
        }
      });

      // Cria a relação de transferência
      await prisma.transferTransaction.create({
        data: {
          source_transaction_id: tx.id,
          dest_transaction_id: destTx.id,
          fee_amount: feeAmount,
          description: `Liquidação Automática ${machineName} ${paymentMethodRaw}`,
          is_automated: true
        }
      });

      // Se houver taxa, registrar a despesa na conta real para conciliação contábil correta
      if (feeAmount > 0) {
        await prisma.transaction.create({
          data: {
            operation: 'expense',
            amount: feeAmount,
            totalValue: feeAmount,
            description: `Taxa Máquina (${taxPercentage}%): ${tx.description}`,
            account_id: defaultAccount.id,
            confirmed: true,
            data_emissao: new Date(),
            data_vencimento: new Date(),
            payment_method: 'TAXA_BANCARIA',
          }
        });
      }
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
