// Cek status RLS + policy kedua tabel (AbsensiMusyrif vs Setoran).
// Jalankan: NODE_PATH=/tmp/sqlcheck/node_modules node scripts/check-rls.js
const { Client } = require('pg')

const DIRECT_URL = process.env.DIRECT_URL || require('fs').readFileSync('/home/z/my-project/.env.local', 'utf8')
  .split('\n').find((l) => l.startsWith('DIRECT_URL=')).slice('DIRECT_URL='.length)

async function main() {
  const c = new Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const rls = await c.query(
    "SELECT c.relname, c.relrowsecurity AS rls_aktif, c.relforcerowsecurity AS force_rls " +
    "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
    "WHERE n.nspname = 'public' AND c.relname IN ('Setoran', 'AbsensiMusyrif')"
  )
  console.log('RLS:', rls.rows)
  const pol = await c.query(
    "SELECT tablename, policyname, cmd, roles FROM pg_policies " +
    "WHERE schemaname='public' AND tablename IN ('Setoran','AbsensiMusyrif')"
  )
  console.log('POLICIES:', pol.rows)
  await c.end()
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
