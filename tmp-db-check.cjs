const { Client } = require('pg')
const c = new Client({ connectionString: process.env.DATABASE_URL })
;(async () => {
  await c.connect()
  const q = async (label, sql) => { console.log('\n## ' + label); console.log(JSON.stringify((await c.query(sql)).rows, null, 2)) }
  await q('profile columns', "select column_name from information_schema.columns where table_schema='public' and table_name='company_profiles' order by ordinal_position")
  await q('ifood token state', 'select "ifoodAccessToken" is not null and "ifoodAccessToken" <> \'\' as has_access_token, "ifoodRefreshToken" is not null and "ifoodRefreshToken" <> \'\' as has_refresh_token, "ifoodTokenExpiresAt" from company_profiles')
  await q('recent ifood logs', 'select method, endpoint, response_status, success, order_id, duration_ms, created_at, left(coalesce(error_message, \'\'), 300) as error_message from ifood_api_logs order by created_at desc limit 30')
  await q('recent delivery orders', "select uuid, display_id, origem, status, status_delivery, data_abertura, left(coalesce(observacao,''), 180) as observacao from pedidos where origem ilike '%delivery%' order by data_abertura desc limit 20")
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
