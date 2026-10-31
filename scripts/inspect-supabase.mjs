// Inspeksi kondisi database Supabase: tabel, kolom, jumlah baris, auth.users, bucket
import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 10, max: 1 })

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
console.log('TABEL:', tables.map(t => t.table_name).join(', '))

for (const t of ['Admin', 'Musyrif']) {
  const cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`
  console.log(`\nKOLOM ${t}:`, cols.map(c => `${c.column_name}:${c.data_type}`).join(', '))
  const rows = await sql.unsafe(`SELECT * FROM "${t}" LIMIT 5`)
  console.log(`BARIS ${t}:`, JSON.stringify(rows, (k, v) => (typeof v === 'bigint' ? String(v) : v)))
}

const users = await sql`SELECT id, email, email_confirmed_at IS NOT NULL as confirmed, raw_app_meta_data FROM auth.users ORDER BY created_at`
console.log('\nAUTH.USERS:', JSON.stringify(users, null, 1))

const pub = await sql`SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'`
console.log('\nREALTIME PUBLICATION:', pub.map(p => p.tablename).join(', ') || '(kosong)')

const buckets = await sql`SELECT id, public FROM storage.buckets`
console.log('BUCKETS:', JSON.stringify(buckets))

const rls = await sql`
  SELECT c.relname, c.relrowsecurity as rls FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`
console.log('\nRLS:', rls.map(r => `${r.relname}=${r.rls}`).join(', '))

await sql.end()
