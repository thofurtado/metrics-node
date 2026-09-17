
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_restaurante",
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT created_at, method, endpoint, response_status, order_id, success, error_message, request_body, response_body
      FROM ifood_api_logs
      WHERE order_id = 'a0ec8dbd-166c-4bab-b5ae-307713338922' 
         OR response_body::text LIKE '%a0ec8dbd-166c-4bab-b5ae-307713338922%'
      ORDER BY created_at ASC
    `);
    console.log("All logs for test order a0ec8dbd-166c-4bab-b5ae-307713338922 (" + res.rows.length + "):");
    for (const r of res.rows) {
      console.log(`[${r.created_at.toISOString()}] ${r.method} ${r.endpoint} -> Status ${r.response_status}, Success: ${r.success}`);
      if (r.request_body) console.log("   Req: " + JSON.stringify(r.request_body));
      if (r.response_body) console.log("   Resp: " + JSON.stringify(r.response_body));
    }
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
