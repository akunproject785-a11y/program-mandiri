/**
 * Migrasi fitur Tahun Ajaran Ujian pada DB produksi (idempotent, SQL langsung
 * via DIRECT_URL):
 * 1. Kolom "tahunAjaran" pada "Ujian" dan "TpUjian" — data dipisahkan per
 *    tahun ajaran yang diatur admin; mengganti tahun ajaran memindahkan data
 *    yang digunakan ke data tahun ajaran baru (data lama tetap tersimpan).
 * 2. Setting awal 'ujian_tahun_ajaran' = '' (belum diatur — admin wajib mengisi
 *    sebelum dapat mengaktifkan menu Ujian musyrif).
 * Jalankan: bun scripts/migrasi-tahun-ajaran-ujian.mjs (DIRECT_URL dari .env.local)
 */
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
)

const sql = postgres(env.DIRECT_URL, { connect_timeout: 10, max: 1 })

await sql`ALTER TABLE "Ujian" ADD COLUMN IF NOT EXISTS "tahunAjaran" TEXT NOT NULL DEFAULT ''`
await sql`ALTER TABLE "TpUjian" ADD COLUMN IF NOT EXISTS "tahunAjaran" TEXT NOT NULL DEFAULT ''`
console.log('✅ kolom "tahunAjaran" pada Ujian & TpUjian siap')

await sql`CREATE INDEX IF NOT EXISTS "Ujian_tahunAjaran_idx" ON "Ujian"("tahunAjaran")`
await sql`CREATE INDEX IF NOT EXISTS "Ujian_musyrifId_tahunAjaran_idx" ON "Ujian"("musyrifId","tahunAjaran")`
await sql`CREATE INDEX IF NOT EXISTS "TpUjian_musyrifId_tahunAjaran_idx" ON "TpUjian"("musyrifId","tahunAjaran")`
await sql`DROP INDEX IF EXISTS "TpUjian_musyrifId_idx"`
console.log('✅ index tahun ajaran siap')

await sql`
  INSERT INTO "Setting" ("key", "value") VALUES ('ujian_tahun_ajaran', '')
  ON CONFLICT ("key") DO NOTHING`
const cur = await sql`SELECT value FROM "Setting" WHERE key = 'ujian_tahun_ajaran'`
console.log('✅ Setting ujian_tahun_ajaran =', JSON.stringify(cur[0]?.value), '(kosong = belum diatur admin)')

await sql.end()
console.log('Migrasi tahun ajaran selesai.')
