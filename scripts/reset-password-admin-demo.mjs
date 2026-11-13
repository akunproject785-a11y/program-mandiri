/**
 * Reset password akun auth admin@quranmandiri.id ke nilai demo terdokumentasi
 * (admin123) via Supabase Admin API — mengembalikan perilaku yang dijanjikan
 * scripts/supabase-seed.mjs (bila akun sempat terlewati saat seed).
 * SERVICE ROLE KEY dibaca dari .env.local; JANGAN pernah mencetak key.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await supabase.auth.admin.listUsers()
if (error) throw error
const admin = (data.users ?? []).find((u) => (u.email ?? '').toLowerCase() === 'admin@quranmandiri.id')
if (!admin) throw new Error('auth user admin@quranmandiri.id tidak ditemukan')

const { error: upErr } = await supabase.auth.admin.updateUserById(admin.id, {
  password: 'admin123',
})
if (upErr) throw upErr
console.log('password admin@quranmandiri.id direset ke admin123 (authUserId: ' + admin.id.slice(0, 8) + '…)')
