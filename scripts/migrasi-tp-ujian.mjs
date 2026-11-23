/**
 * Migrasi fitur Tujuan Pembelajaran (TP) Ujian pada DB produksi (idempotent,
 * SQL langsung via DIRECT_URL):
 * 1. Tabel "TpUjian" — TP milik musyrif (minimal 2 sebelum bisa ujian siswa).
 * 2. Tabel "NilaiTp" — breakdown nilai per TP untuk tiap record Ujian.
 * Jalankan: bun scripts/migrasi-tp-ujian.mjs  (DIRECT_URL dibaca dari .env.local)
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
  CREATE TABLE IF NOT EXISTS "TpUjian" (
    "id" TEXT PRIMARY KEY,
    "musyrifId" TEXT NOT NULL REFERENCES "Musyrif"("id") ON DELETE CASCADE,
    "teks" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
console.log('✅ tabel "TpUjian" siap')

// Kolom urutan untuk penomoran TP deterministik (tambah bila tabel lama belum punya).
await sql`ALTER TABLE "TpUjian" ADD COLUMN IF NOT EXISTS "urutan" INTEGER NOT NULL DEFAULT 0`
await sql`
  WITH nomor AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "musyrifId" ORDER BY "createdAt", "id") - 1 AS n
    FROM "TpUjian"
  )
  UPDATE "TpUjian" t SET "urutan" = nomor.n FROM nomor WHERE nomor."id" = t."id" AND t."urutan" = 0`
console.log('✅ kolom "urutan" + backfill siap')

await sql`
  CREATE TABLE IF NOT EXISTS "NilaiTp" (
    "id" TEXT PRIMARY KEY,
    "ujianId" TEXT NOT NULL REFERENCES "Ujian"("id") ON DELETE CASCADE,
    "tpId" TEXT NOT NULL REFERENCES "TpUjian"("id") ON DELETE CASCADE,
    "nilai" INTEGER NOT NULL
  )`
console.log('✅ tabel "NilaiTp" siap')

await sql`CREATE UNIQUE INDEX IF NOT EXISTS "NilaiTp_ujianId_tpId_key" ON "NilaiTp"("ujianId","tpId")`
await sql`CREATE INDEX IF NOT EXISTS "NilaiTp_tpId_idx" ON "NilaiTp"("tpId")`
await sql`CREATE INDEX IF NOT EXISTS "TpUjian_musyrifId_idx" ON "TpUjian"("musyrifId")`
console.log('✅ index TpUjian/NilaiTp siap')

await sql.end()
console.log('Migrasi TP selesai.')
