/** Cari region Supavisor yang benar untuk project ref ini (uji query nyata per region) */
import { PrismaClient } from '@prisma/client'

const PW = process.env.SUPABASE_DB_PASSWORD_ENCODED ?? ''
if (!PW) { console.error('Set SUPABASE_DB_PASSWORD_ENCODED (password DB dengan # sebagai %23)'); process.exit(1) }
const REF = 'xlajpidborknuanvernc'

const regions = [
  'ap-southeast-1', 'ap-southeast-2', 'us-east-1', 'us-east-2', 'us-west-1',
  'us-west-2', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'eu-central-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
  'ca-central-1', 'sa-east-1',
]

for (const r of regions) {
  const url = `postgresql://postgres.${REF}:${PW}@aws-0-${r}.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=5&pool_timeout=5`
  const p = new PrismaClient({ datasources: { db: { url } } })
  try {
    await p.$queryRaw`select 1`
    console.log('FOUND REGION:', r)
    await p.$disconnect()
    process.exit(0)
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 90).replace(/\n/g, ' ')
    console.log(r.padEnd(16), 'FAIL:', msg)
    await p.$disconnect().catch(() => {})
  }
}
console.log('NO REGION MATCHED')
process.exit(1)
