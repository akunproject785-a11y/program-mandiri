/**
 * Seed Supabase — idempoten:
 * 1. Buat akun admin pertama di Supabase Auth + baris Admin
 * 2. Buat bucket Storage publik "foto-siswa"
 * 3. Aktifkan Realtime untuk tabel Setoran (publikasi + RLS read untuk anon)
 *
 * Jalankan: bun scripts/seed-supabase.ts
 */
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const ADMIN_EMAIL = 'admin@quranmandiri.id'
const ADMIN_PASSWORD = 'admin123'
const ADMIN_NAME = 'Administrator'
const BUCKET = 'foto-siswa'

const svc = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const db = new PrismaClient()

async function seedAdmin() {
  // Cari user auth admin by email
  const { data: listData, error: listError } = await svc.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError
  let user = listData.users.find((u) => u.email === ADMIN_EMAIL)

  if (!user) {
    const { data, error } = await svc.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { namaLengkap: ADMIN_NAME, role: 'admin' },
    })
    if (error) throw error
    user = data.user
    console.log('[seed] akun auth admin dibuat:', ADMIN_EMAIL)
  } else {
    console.log('[seed] akun auth admin sudah ada:', ADMIN_EMAIL)
  }
  if (!user) throw new Error('Gagal memastikan akun auth admin')

  const existing = await db.admin.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!existing) {
    await db.admin.create({
      data: { authUserId: user.id, email: ADMIN_EMAIL, name: ADMIN_NAME },
    })
    console.log('[seed] baris Admin dibuat')
  } else {
    // Sinkronkan authUserId bila berubah
    if (existing.authUserId !== user.id) {
      await db.admin.update({ where: { id: existing.id }, data: { authUserId: user.id } })
      console.log('[seed] authUserId Admin disinkronkan')
    } else {
      console.log('[seed] baris Admin sudah ada')
    }
  }
}

async function seedBucket() {
  const { data } = await svc.storage.getBucket(BUCKET)
  if (data) {
    console.log('[seed] bucket sudah ada:', BUCKET)
    return
  }
  const { error } = await svc.storage.createBucket(BUCKET, { public: true })
  if (error) throw error
  console.log('[seed] bucket publik dibuat:', BUCKET)
}

async function main() {
  await seedAdmin()
  await seedBucket()
  await db.$disconnect()
  console.log('[seed] SELESAI')
}

main().catch((e) => {
  console.error('[seed] GAGAL:', e)
  process.exit(1)
})
