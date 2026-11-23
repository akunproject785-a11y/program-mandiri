/**
 * Migrasi fitur Ujian pada DB produksi (idempotent, SQL langsung via DIRECT_URL):
 * 1. Tabel "Ujian" (hasil ujian hafalan siswa per musyrif).
 * 2. Setting awal 'ujian_musyrif_aktif' = '0' (menu Ujian musyrif default mati;
 *    admin mengaktifkannya dari menu Ujian).
 * Jalankan: bun scripts/migrasi-ujian.mjs  (DIRECT_URL dibaca dari .env.local)
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

await sql`
  CREATE TABLE IF NOT EXISTS "Ujian" (
    "id" TEXT PRIMARY KEY,
    "musyrifId" TEXT NOT NULL REFERENCES "Musyrif"("id") ON DELETE CASCADE,
    "siswaId" TEXT NOT NULL REFERENCES "Siswa"("id") ON DELETE CASCADE,
    "tanggal" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "bab" TEXT,
    "nilai" INTEGER NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
console.log('✅ tabel "Ujian" siap')

await sql`CREATE INDEX IF NOT EXISTS "Ujian_musyrifId_tanggal_idx" ON "Ujian"("musyrifId","tanggal")`
await sql`CREATE INDEX IF NOT EXISTS "Ujian_siswaId_idx" ON "Ujian"("siswaId")`
console.log('✅ index Ujian siap')

await sql`
  INSERT INTO "Setting" ("key", "value") VALUES ('ujian_musyrif_aktif', '0')
  ON CONFLICT ("key") DO NOTHING`
const cur = await sql`SELECT value FROM "Setting" WHERE key = 'ujian_musyrif_aktif'`
console.log('✅ Setting ujian_musyrif_aktif =', cur[0]?.value)

await sql.end()
console.log('Migrasi selesai.')
