/**
 * Seed Supabase (idempotent):
 * 1. Reset password akun auth yang sudah ada ke nilai demo yang diketahui
 *    (kredensial lama tidak tersimpan setelah workspace reset).
 * 2. Pastikan setiap user auth punya baris profil (Admin/Musyrif) dengan authUserId cocok.
 * 3. Pastikan bucket 'foto-siswa' public ada.
 * Jalankan: SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... bun scripts/supabase-seed.mjs
 *   (env dibaca dari .env oleh bun otomatis)
 */
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

/** Fallback: bila DATABASE_URL env bukan postgres:// (mis. injeksi lama file:), baca .env */
function resolveDatabaseUrl() {
  const env = process.env.DATABASE_URL
  if (env && /^postgres(ql)?:\/\//.test(env)) return env
  try {
    const content = fs.readFileSync('.env', 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const m = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line)
      if (m) {
        const val = m[1].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
        if (val) return val
      }
    }
  } catch {}
  return env
}

const db = new PrismaClient({ datasourceUrl: resolveDatabaseUrl() })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ACCOUNTS = [
  { email: 'admin@quranmandiri.id', password: 'admin123', role: 'admin' },
  { email: 'amanda@quranmandiri.id', password: 'musyrif123', role: 'musyrif' },
  { email: 'nazar@quranmandiri.id', password: 'musyrif123', role: 'musyrif' },
]

async function main() {
  // ===== 1. Ambil semua user auth =====
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw new Error('listUsers gagal: ' + listError.message)
  const users = listData.users ?? []
  console.log(`Ditemukan ${users.length} user auth`)

  for (const acc of ACCOUNTS) {
    const user = users.find((u) => (u.email ?? '').toLowerCase() === acc.email)
    if (!user) {
      console.log(`⚠️  ${acc.email} tidak ditemukan — lewati (buat manual bila perlu)`)
      continue
    }

    // Reset password ke nilai yang diketahui
    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      password: acc.password,
      email_confirm: true,
    })
    if (updErr) throw new Error(`Reset password ${acc.email} gagal: ${updErr.message}`)
    console.log(`✅ Password ${acc.email} direset ke "${acc.password}"`)

    // ===== 2. Pastikan profil aplikasi ada =====
    if (acc.role === 'admin') {
      await db.admin.upsert({
        where: { authUserId: user.id },
        update: { email: acc.email },
        create: { authUserId: user.id, email: acc.email, name: 'Administrator' },
      })
      console.log(`   Profil Admin ok (authUserId=${user.id})`)
    } else {
      const existing = await db.musyrif.findUnique({ where: { authUserId: user.id } })
      if (!existing) {
        console.log(`   ⚠️  Musyrif ${acc.email} belum punya baris profil — buat manual (NIK/nama)`)
      } else {
        console.log(`   Profil Musyrif ok: ${existing.namaLengkap}`)
      }
    }
  }

  // ===== 3. Bucket foto-siswa =====
  const { data: bucket } = await supabase.storage.getBucket('foto-siswa')
  if (!bucket) {
    const { error: bucketErr } = await supabase.storage.createBucket('foto-siswa', {
      public: true,
      fileSizeLimit: 2097152,
    })
    if (bucketErr) throw new Error('createBucket gagal: ' + bucketErr.message)
    console.log('✅ Bucket "foto-siswa" dibuat (public, limit 2MB)')
  } else {
    console.log('⏭️  Bucket "foto-siswa" sudah ada (public=' + bucket.public + ')')
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
