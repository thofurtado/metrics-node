const { Client } = require('pg');
const https = require('https');

// Configurações
const REDIS_URL = "https://mighty-sturgeon-28585.upstash.io/get/caixa_data_v1";
const REDIS_TOKEN = "AW-pAAIncDFiMzNmNjFkNTNjY2E0MzY5YWIyYTQyYjcyOWZlNzgwYXAxMjg1ODU";
const POSTGRES_URL = "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_marujo?schema=public";

// Função para buscar dados do Redis do App Antigo
function getRedisData() {
  return new Promise((resolve, reject) => {
    https.get(REDIS_URL, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`Erro Redis: ${res.statusCode} ${body}`));
          }
          const data = JSON.parse(body);
          const rawResult = data.result;
          resolve(typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Execução principal
async function main() {
  console.log("=== INICIANDO RE-IMPORTAÇÃO E CORREÇÃO DE CAIXINHAS ===");
  
  let lotesRedis;
  try {
    lotesRedis = await getRedisData();
    console.log(`[+] Sucesso ao ler Redis. Encontrados ${lotesRedis.length} lotes.`);
  } catch (err) {
    console.error("[-] Falha ao ler dados do Redis:", err.message);
    return;
  }

  const client = new Client({ connectionString: POSTGRES_URL, ssl: false });
  try {
    await client.connect();
    console.log("[+] Conectado ao banco de dados PostgreSQL (db_marujo).");

    // Iniciar uma transação para garantir segurança
    await client.query('BEGIN');

    let totalSessoesCorrigidas = 0;
    let totalEntradasInseridas = 0;

    for (const lote of lotesRedis) {
      const dataRef = lote.dataReferencia; // formato 'YYYY-MM-DD'
      const periodo = lote.periodo; // 'Almoço' ou 'Jantar'

      // 1. Localizar a sessão correspondente no Postgres
      // O campo opened_at é um DateTime. Comparamos apenas a parte da data no fuso de Brasília (ou UTC, conforme salvo)
      const querySession = `
        SELECT id, status, opened_at 
        FROM cashier_sessions 
        WHERE DATE(opened_at AT TIME ZONE 'America/Sao_Paulo') = $1 AND period = $2
        LIMIT 1;
      `;
      const resSession = await client.query(querySession, [dataRef, periodo]);
      
      if (resSession.rows.length === 0) {
        // Se não encontrar usando TIME ZONE de São Paulo, tenta comparação direta de string da data UTC
        const querySessionUTC = `
          SELECT id, status, opened_at 
          FROM cashier_sessions 
          WHERE DATE(opened_at) = $1 AND period = $2
          LIMIT 1;
        `;
        const resSessionUTC = await client.query(querySessionUTC, [dataRef, periodo]);
        if (resSessionUTC.rows.length === 0) {
          console.log(`[i] Sessão de ${dataRef} (${periodo}) não foi encontrada no Postgres. Pulando.`);
          continue;
        }
        resSession.rows = resSessionUTC.rows;
      }

      const session = resSession.rows[0];
      const sessionId = session.id;
      console.log(`\n[Caixa: ${dataRef} - ${periodo}] -> Sessão encontrada ID: ${sessionId}`);

      // 2. Limpar os lançamentos atuais desta sessão no Postgres
      const queryDelete = `DELETE FROM cashier_entries WHERE cashier_session_id = $1;`;
      await client.query(queryDelete, [sessionId]);
      console.log(`   └─ [Deletado] Lançamentos antigos da sessão.`);

      // 3. Processar e re-inserir cada lançamento do Redis
      const lancamentos = lote.lancamentos || [];
      for (const lan of lancamentos) {
        let is_withdrawal = false;
        let is_addition = false;
        let is_tip = false;
        let type = 'SALE';
        let amount = Number(lan.valor || 0);
        let valorCaixinha = Number(lan.valorCaixinha || 0);
        let payment_method = lan.formaPagamento || 'Dinheiro';
        let bank = lan.banco || 'CAIXA';
        let origin = 'Mesa';
        let identification = lan.mesa || lan.identificacao || '';

        // Determinar origem (origin) baseada no campo mesa
        const mesaStr = (lan.mesa || '').toUpperCase();
        if (mesaStr.includes('DELIVERY')) {
          origin = 'Delivery';
        } else if (mesaStr.includes('BALCAO') || mesaStr.includes('BALCÃO')) {
          origin = 'Balcão';
        } else {
          origin = 'Mesa';
        }

        // Definir os tipos de lançamento
        if (lan.isSaida) {
          is_withdrawal = true;
          type = 'WITHDRAWAL';
          payment_method = 'Sangria';
          bank = 'CAIXA';
          identification = lan.identificacao || 'Retirada de Caixa';
        } else if (lan.isSuprimento) {
          is_addition = true;
          type = 'ADDITION';
          payment_method = 'Suprimento';
          bank = 'CAIXA';
          identification = lan.identificacao || 'Aporte de Caixa';
        } else if (amount === valorCaixinha && valorCaixinha > 0) {
          // Caixinha pura/avulsa (sem venda acoplada)
          is_tip = true;
          type = 'TIP';
          identification = lan.paraQuem || 'Geral';
        } else {
          // Venda comum ou Venda com Caixinha acoplada
          type = 'SALE';
          const mesaOrigem = lan.mesa ? lan.mesa : (origin === 'Delivery' ? 'Delivery' : 'Balcão');
          const consumidor = lan.consumidorCasa ? lan.consumidorCasa : '';
          const baseIdent = consumidor || mesaOrigem;
          
          if (valorCaixinha > 0) {
            // Mapeia usando a tag correta [Gorjeta: R$ X.XX | Colaborador] esperada pelo Metrics
            identification = `${baseIdent} [Gorjeta: R$ ${valorCaixinha.toFixed(2)} | ${lan.paraQuem || 'Geral'}]`;
          } else {
            identification = baseIdent;
          }
        }

        // Inserir o registro correto no Postgres
        const queryInsert = `
          INSERT INTO cashier_entries (
            id, cashier_session_id, origin, bank, payment_method, amount, 
            is_withdrawal, is_addition, is_tip, is_checked, type, 
            identification, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 
            $6, $7, $8, $9, $10, 
            $11, $12, $13
          );
        `;

        // Preservamos a data de criação baseada no timestamp do Redis (id do lançamento é o timestamp Unix)
        let createdAt = new Date();
        if (lan.id && !isNaN(Number(lan.id))) {
          createdAt = new Date(Number(lan.id));
        }

        await client.query(queryInsert, [
          sessionId, origin, bank, payment_method, amount,
          is_withdrawal, is_addition, is_tip, false, type,
          identification, createdAt, createdAt
        ]);

        totalEntradasInseridas++;
      }

      totalSessoesCorrigidas++;
      console.log(`   └─ [Inserido] ${lancamentos.length} novos lançamentos corrigidos.`);
    }

    // Confirmar a transação
    await client.query('COMMIT');
    console.log(`\n[SUCESSO] Processo finalizado com sucesso!`);
    console.log(`Total de Sessões Corrigidas: ${totalSessoesCorrigidas}`);
    console.log(`Total de Lançamentos Gravados: ${totalEntradasInseridas}`);

  } catch (err) {
    // Em caso de erro, reverte todas as alterações da transação
    console.error("\n[-] Erro durante a correção. Executando ROLLBACK...");
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
