// Cek isi publication supabase_realtime (tabel mana saja yang di-broadcast).
// Jalankan: NODE_PATH=/tmp/sqlcheck/node_modules node scripts/check-realtime-pub.js
const { Client } = require('pg')

const DIRECT_URL = process.env.DIRECT_URL || require('fs').readFileSync('/home/z/my-project/.env.local', 'utf8')
  .split('\n').find((l) => l.startsWith('DIRECT_URL=')).slice('DIRECT_URL='.length)

async function main() {
  const c = new Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const { rows } = await c.query(
    "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename"
  )
  console.log('TABEL DI supabase_realtime:', rows.map((r) => r.tablename))
  await c.end()
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
