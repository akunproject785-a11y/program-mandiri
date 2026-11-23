/** Buat profil Admin lokal untuk E2E (authUserId = user auth admin@quranmandiri.id). */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
)

const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@quranmandiri.id', password: 'admin123' }),
})
const d = await r.json()
if (!d.user) throw new Error('login admin gagal: ' + JSON.stringify(d).slice(0, 120))
const authUserId = d.user.id

const db = new PrismaClient()
const admin = await db.admin.upsert({
  where: { authUserId },
  create: { authUserId, email: 'admin@quranmandiri.id', username: 'admin', name: 'Admin Uji' },
  update: { name: 'Admin Uji' },
})
console.log('Admin lokal siap:', admin.id, '| authUserId:', admin.authUserId)
await db.$disconnect()
