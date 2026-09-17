
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_restaurante",
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT created_at, method, endpoint, response_status, order_id, success, error_message, request_body, response_body
      FROM ifood_api_logs
      WHERE endpoint NOT LIKE '%events:polling' OR response_status != 204
      ORDER BY created_at DESC
      LIMIT 50
    `);
    console.log("Filtered iFood Logs (" + res.rows.length + "):");
    for (const r of res.rows) {
      console.log(`[${r.created_at.toISOString()}] ${r.method} ${r.endpoint} -> Status ${r.response_status}, Success: ${r.success}, Order: ${r.order_id}`);
      if (r.error_message) console.log("   Err: " + r.error_message);
      if (r.request_body) console.log("   Req: " + JSON.stringify(r.request_body).substring(0, 200));
      if (r.response_body) console.log("   Resp: " + JSON.stringify(r.response_body).substring(0, 200));
    }
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
