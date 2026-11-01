// Aktifkan realtime AbsensiMusyrif untuk dashboard admin.
// Browser konek ke Supabase Realtime sebagai role `anon` (login app = username/password
// custom via Prisma, bukan Supabase Auth), jadi event postgres_changes hanya sampai
// bila ada policy SELECT untuk anon. Policy dibuat minimal:
//   - baris: hanya status PENDING (yang relevan utk notifikasi "menunggu ACC")
//   - kolom: id, musyrifId, tanggal, status (fotoUrl/keterangan/catatanAdmin tidak dibuka)
// Event dipakai hanya sebagai TRIGGER refetch; data sesungguhnya diambil lewat API
// /api/absensi/admin yang tetap butuh login admin (RLS tidak berlaku utk Prisma/owner).
// Idempoten: aman dijalankan berulang.
// Jalankan: NODE_PATH=/tmp/sqlcheck/node_modules node scripts/enable-absensi-realtime.js
const { Client } = require('pg')

const DIRECT_URL = process.env.DIRECT_URL || require('fs').readFileSync('/home/z/my-project/.env.local', 'utf8')
  .split('\n').find((l) => l.startsWith('DIRECT_URL=')).slice('DIRECT_URL='.length)

const KOLUMAN_AMAN = 'id, "musyrifId", "tanggal", "status"'

async function main() {
  const c = new Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const sudah = await c.query(
    "SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='AbsensiMusyrif' AND policyname='anon realtime read pending'"
  )
  if (sudah.rowCount === 0) {
    await c.query(
      `CREATE POLICY "anon realtime read pending" ON "AbsensiMusyrif"
       FOR SELECT TO anon
       USING (status = 'PENDING')`
    )
    console.log('Policy dibuat: anon realtime read pending (hanya baris PENDING)')
  } else {
    console.log('Policy sudah ada, lewati')
  }

  // Batasi kolom yang bisa dibaca anon (foto & catatan tidak terekspos).
  await c.query(`REVOKE SELECT ON "AbsensiMusyrif" FROM anon`)
  await c.query(`GRANT SELECT (${KOLUMAN_AMAN}) ON "AbsensiMusyrif" TO anon`)
  console.log('Grant kolom anon:', KOLUMAN_AMAN)

  // Pastikan tabel tetap anggota publication realtime.
  const pub = await c.query(
    "SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='AbsensiMusyrif'"
  )
  console.log('Di publication supabase_realtime:', pub.rowCount > 0 ? 'YA' : 'TIDAK')

  const cek = await c.query(
    "SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename='AbsensiMusyrif'"
  )
  console.log('Policies sekarang:', cek.rows)
  await c.end()
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
