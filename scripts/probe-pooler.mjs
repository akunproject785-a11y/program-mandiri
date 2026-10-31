// Probe region pooler Supabase: coba autentikasi ke tiap kandidat region.
// Region benar = query berhasil ATAU error autentikasi password (bukan user tidak dikenal/timeout).
import postgres from 'postgres'

const REF = 'xlajpidborknuanvernc'
const PW_ENCODED = process.env.SUPABASE_DB_PASSWORD_ENCODED ?? ''
if (!PW_ENCODED) { console.error('Set SUPABASE_DB_PASSWORD_ENCODED (password DB dengan # sebagai %23)'); process.exit(1) }
const REGIONS = [
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-south-1',
  'ap-northeast-1',
  'us-east-1',
  'us-west-1',
  'eu-west-1',
  'eu-central-1',
]

for (const region of REGIONS) {
  const url = `postgresql://postgres.${REF}:${PW_ENCODED}@aws-0-${region}.pooler.supabase.com:6543/postgres`
  const sql = postgres(url, { connect_timeout: 6, max: 1, idle_timeout: 1 })
  try {
    const res = await sql`select current_database() as db, current_user as usr, inet_server_addr()::text as ip`
    console.log(`✅ COCOK: ${region}`, JSON.stringify(res[0]))
    await sql.end()
    process.exit(0)
  } catch (e) {
    const msg = String(e?.message ?? e)
    let verdict = '❌ bukan region ini'
    if (/password authentication failed/i.test(msg)) verdict = '⚠️ REGION MUNGKIN BENAR tapi password salah'
    if (/does not exist|invalid username/i.test(msg)) verdict = '❌ user tidak dikenal (region salah)'
    console.log(`${verdict} — ${region}: ${msg.slice(0, 120)}`)
    try { await sql.end({ timeout: 1 }) } catch {}
  }
}
console.log('Selesai: tidak ada region yang cocok.')
process.exit(1)
