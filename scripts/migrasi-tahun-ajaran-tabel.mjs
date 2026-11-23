/**
 * Migrasi fitur "daftar Tahun Ajaran" pada DB produksi (idempotent):
 * 1. Buat tabel "TahunAjaran" (label unik, penanda aktif, createdAt).
 * 2. Seed: bila tabel kosong dan Setting 'ujian_tahun_ajaran' berisi label
 *    (mis. '2026/2027'), buat entri tersebut sebagai tahun ajaran AKTIF —
 *    alur Task 50 (Setting tunggal) dimigrasi ke tabel daftar Task 51.
 * 3. Hapus Setting 'ujian_tahun_ajaran' (tidak lagi dipakai; sumber kini
 *    baris aktif pada tabel TahunAjaran).
 * Jalankan: bun scripts/migrasi-tahun-ajaran-tabel.mjs (DIRECT_URL dari .env.local)
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
)

const sql = postgres(env.DIRECT_URL, { connect_timeout: 10, max: 1 })

await sql`CREATE TABLE IF NOT EXISTS "TahunAjaran" (
  "id" TEXT PRIMARY KEY,
  "label" TEXT NOT NULL UNIQUE,
  "aktif" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
)`
console.log('✅ tabel "TahunAjaran" siap')

const count = await sql`SELECT COUNT(*)::int n FROM "TahunAjaran"`
if (count[0].n === 0) {
  const lama = await sql`SELECT value FROM "Setting" WHERE key = 'ujian_tahun_ajaran'`
  const label = lama[0]?.value?.trim() || '2026/2027'
  await sql`INSERT INTO "TahunAjaran" ("id", "label", "aktif") VALUES (${randomUUID()}, ${label}, true)`
  console.log(`✅ seed tahun ajaran aktif: "${label}"`)
} else {
  console.log(`ℹ️ tabel sudah berisi ${count[0].n} tahun ajaran — seed dilewati`)
}

await sql`DELETE FROM "Setting" WHERE key = 'ujian_tahun_ajaran'`
const daftar = await sql`SELECT label, aktif FROM "TahunAjaran" ORDER BY "createdAt"`
console.log('✅ Setting lama dihapus; daftar TA:', JSON.stringify(daftar))

await sql.end()
console.log('Migrasi tabel TahunAjaran selesai.')
