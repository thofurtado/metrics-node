const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const POSTGRES_URL = "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_marujo?schema=public";
const BACKUP_PATH = "C:\\Users\\Thomás Furtado\\Documents\\backup_marujo_2026_07_28.json";

async function run() {
  console.log("=== INICIANDO BACKUP PROGRAMÁTICO DO BANCO DE DADOS ===");
  const client = new Client({ connectionString: POSTGRES_URL, ssl: false });

  try {
    await client.connect();
    console.log("[+] Conectado ao banco remoto do Marujo.");

    // 1. Obter todas as tabelas públicas do banco
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `;
    const tablesRes = await client.query(tablesQuery);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`[+] Encontradas ${tables.length} tabelas para backup.`);

    const backupData = {};

    // 2. Fazer o dump de cada tabela
    for (const table of tables) {
      console.log(`   └─ Exportando tabela: ${table}...`);
      const dataRes = await client.query(`SELECT * FROM "${table}";`);
      backupData[table] = dataRes.rows;
    }

    // 3. Salvar o arquivo JSON no caminho de Documentos
    console.log("[+] Serializando dados para JSON...");
    const jsonContent = JSON.stringify(backupData, null, 2);
    
    // Garantir que a pasta de destino existe
    const dir = path.dirname(BACKUP_PATH);
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(BACKUP_PATH, jsonContent, 'utf8');
    console.log(`\n[SUCESSO] Backup gravado com sucesso!`);
    console.log(`Arquivo salvo em: ${BACKUP_PATH}`);
    console.log(`Tamanho do arquivo: ${(Buffer.byteLength(jsonContent) / 1024 / 1024).toFixed(2)} MB`);

  } catch (err) {
    console.error("[-] Falha ao realizar o backup:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
