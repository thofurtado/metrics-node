const { Client } = require('pg');

const connectionString = "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_marujo?schema=public";

async function run() {
  const client = new Client({
    connectionString: connectionString,
    ssl: false
  });

  try {
    await client.connect();
    console.log("Conectado ao banco do Marujo!");

    // Buscar especificamente registros que tenham os valores das vendas originais indicadas pelo usuário
    const query = `
      SELECT id, amount, is_tip, payment_method, identification, created_at 
      FROM cashier_entries 
      WHERE (amount IN (101.64, 183.75, 389.07, 7.90, 205.00, 848.67) 
         OR amount IN (1.09, 1.35, 0.37, 0.40, 9.10, 7.10))
         AND cashier_session_id = '72a7ca4f-b953-48bd-ac90-9aa2b0f4cb01'
      ORDER BY amount DESC, is_tip ASC;
    `;
    const res = await client.query(query);
    console.log("Registros encontrados para a sessão 72a7ca4f-b953-48bd-ac90-9aa2b0f4cb01:");
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error("Erro na execução:", err);
  } finally {
    await client.end();
  }
}

run();
