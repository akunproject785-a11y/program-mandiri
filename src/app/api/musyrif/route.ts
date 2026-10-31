import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'
import { isUniqueViolation } from '@/app/api/_lib/shared'
import { createAuthUser, extractAuthError } from '@/lib/supabase/accounts'
import {
  fallbackUsername,
  normalizeUsername,
  usernameFromEmail,
  validateUsername,
} from '@/lib/username'

const musyrifSelect = {
  id: true,
  nik: true,
  namaLengkap: true,
  email: true,
  username: true,
} as const

/** Resolusi username akhir + cek duplikat lintas Admin & Musyrif.
 *  Mengembalikan {error} bila bentrok dan tidak bisa di-otomatisasi. */
async function resolveUsername(
  raw: string,
  email: string,
  opts: { excludeMusyrifId?: string } = {}
): Promise<{ username: string } | { error: string }> {
  let candidate = raw ? normalizeUsername(raw) : usernameFromEmail(email)
  const invalid = validateUsername(candidate)
  if (invalid) return { error: invalid }

  const free = async (u: string) => {
    const [dupM, dupA] = await Promise.all([
      db.musyrif.findFirst({
        where: { username: u, ...(opts.excludeMusyrifId ? { id: { not: opts.excludeMusyrifId } } : {}) },
        select: { id: true },
      }),
      db.admin.findUnique({ where: { username: u }, select: { id: true } }),
    ])
    return !dupM && !dupA
  }

  // Username diisi manual & bentrok → tolak (jangan diam-diam diubah).
  if (raw && !(await free(candidate))) {
    return { error: 'Username sudah dipakai akun lain' }
  }
  // Otomatis (kosong) & bentrok → coba variasi suffix pendek.
  if (!raw && !(await free(candidate))) {
    for (let i = 0; i < 3; i++) {
      const alt = `${candidate}_${Math.random().toString(36).slice(2, 5)}`
      if (await free(alt)) return { username: alt }
    }
    return { username: fallbackUsername() }
  }
  return { username: candidate }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** GET /api/musyrif — auth. Tanpa kredensial. Urut createdAt asc */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    const musyrif = await db.musyrif.findMany({
      select: musyrifSelect,
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ musyrif })
  } catch (e) {
    console.error('[musyrif GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** POST /api/musyrif — admin. Membuat user Supabase Auth + baris Musyrif.
 *  409 jika NIK/email duplikat. */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nik = typeof body.nik === 'string' ? body.nik.trim() : ''
    const namaLengkap = typeof body.namaLengkap === 'string' ? body.namaLengkap.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const username = typeof body.username === 'string' ? body.username.trim() : ''

    if (!nik || !namaLengkap || !email || !password) {
      return NextResponse.json(
        { error: 'NIK, nama lengkap, email, dan password wajib diisi' },
        { status: 400 }
      )
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    const [dupNik, dupEmail] = await Promise.all([
      db.musyrif.findUnique({ where: { nik } }),
      db.musyrif.findUnique({ where: { email } }),
    ])
    if (dupNik) {
      return NextResponse.json({ error: 'NIK sudah terdaftar' }, { status: 409 })
    }
    if (dupEmail) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
    }

    // Username login (opsional; kosong = otomatis dari email)
    const resolvedUsername = await resolveUsername(username, email)
    if ('error' in resolvedUsername) {
      return NextResponse.json({ error: resolvedUsername.error }, { status: 400 })
    }

    // Buat user auth (email terkonfirmasi otomatis via service role)
    let authUserId: string
    try {
      authUserId = await createAuthUser({ email, password, namaLengkap })
    } catch (e) {
      return NextResponse.json({ error: extractAuthError(e) }, { status: 400 })
    }

    try {
      const musyrif = await db.musyrif.create({
        data: { nik, namaLengkap, email, username: resolvedUsername.username, authUserId },
        select: musyrifSelect,
      })
      return NextResponse.json({ musyrif })
    } catch (e) {
      // Rollback: baris profil gagal → hapus user auth yang baru dibuat
      const { deleteAuthUser } = await import('@/lib/supabase/accounts')
      await deleteAuthUser(authUserId).catch(() => {})
      throw e
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: 'NIK, email, atau username sudah terdaftar' },
        { status: 409 }
      )
    }
    console.error('[musyrif POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
