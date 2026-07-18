const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_master?schema=public",
});

async function checkTenants() {
  try {
    const res = await pool.query('SELECT domain, "dbName", status FROM "Tenant"');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
checkTenants();
