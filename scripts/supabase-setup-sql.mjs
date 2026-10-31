// Setup SQL admin Supabase:
// 1. Policy SELECT utk role authenticated pada tabel Setoran (agar realtime postgres_changes
//    untuk user login lolos RLS — policy 'anon realtime read' sudah ada sebelumnya).
// 2. Pastikan tabel Setoran masuk publication supabase_realtime (idempotent).
// Jalankan: bun -e "process.env.DIRECT_URL='...'; await import('./scripts/supabase-setup-sql.mjs')"
import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 10, max: 1 })

// --- 1. Policy authenticated read pada Setoran ---
const existing = await sql`
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename='Setoran' AND policyname='authenticated realtime read'`
if (existing.length === 0) {
  await sql`
    CREATE POLICY "authenticated realtime read" ON "Setoran"
    FOR SELECT TO authenticated USING (true)`
  console.log('✅ Policy "authenticated realtime read" dibuat pada Setoran')
} else {
  console.log('⏭️  Policy authenticated sudah ada')
}

// --- 2. Publication realtime: pastikan Setoran terdaftar ---
const inPub = await sql`
  SELECT 1 FROM pg_publication_tables
  WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='Setoran'`
if (inPub.length === 0) {
  await sql`ALTER PUBLICATION supabase_realtime ADD TABLE "Setoran"`
  console.log('✅ Setoran ditambahkan ke publication supabase_realtime')
} else {
  console.log('⏭️  Setoran sudah ada di publication supabase_realtime')
}

const check = await sql`SELECT policyname, roles FROM pg_policies WHERE tablename='Setoran'`
console.log('Policy Setoran sekarang:', JSON.stringify(check))

await sql.end()
