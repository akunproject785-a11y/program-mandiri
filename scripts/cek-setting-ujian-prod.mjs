/** Cek nilai Setting di DB produksi (parsing .env.local gaya migrasi-ujian). */
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
)

const sql = postgres(env.DIRECT_URL, { connect_timeout: 10, max: 1 })
const r = await sql`SELECT value FROM "Setting" WHERE key = 'ujian_musyrif_aktif'`
console.log('DB produksi ujian_musyrif_aktif =', r[0]?.value)
const ujianCount = await sql`SELECT COUNT(*)::int AS n FROM "Ujian"`
console.log('Jumlah baris Ujian produksi =', ujianCount[0]?.n)
await sql.end()
