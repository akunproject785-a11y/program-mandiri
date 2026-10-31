// Cek detail kolom (default/nullability) + RLS policies remote
import postgres from 'postgres'
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 10, max: 1 })

const cols = await sql`
  SELECT table_name, column_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name IN ('Admin','Musyrif','Siswa')
  ORDER BY table_name, ordinal_position`
cols.forEach(c => console.log(`${c.table_name}.${c.column_name} null=${c.is_nullable} def=${c.column_default ?? '-'}`))

const pol = await sql`SELECT schemaname, tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname='public'`
console.log('\nPOLICIES:', pol.length ? JSON.stringify(pol, null, 1) : '(TIDAK ADA)')

const grants = await sql`
  SELECT grantee, string_agg(DISTINCT privilege_type, ',') as privs
  FROM information_schema.role_table_grants
  WHERE table_schema='public' AND grantee IN ('anon','authenticated')
  GROUP BY grantee`
console.log('\nGRANTS:', JSON.stringify(grants))

await sql.end()
