import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isUniqueViolation } from '@/app/api/_lib/shared'
import {
  deleteAuthUser,
  extractAuthError,
  updateAuthUserEmail,
  updateAuthUserPassword,
} from '@/lib/supabase/accounts'
import {
  normalizeUsername,
  usernameFromEmail,
  validateUsername,
} from '@/lib/username'

type RouteParams = { params: Promise<{ id: string }> }

const musyrifSelect = {
  id: true,
  nik: true,
  namaLengkap: true,
  email: true,
  username: true,
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** PUT /api/musyrif/:id — admin. Password kosong = tidak diubah.
 *  Perubahan email/password juga disinkronkan ke Supabase Auth. */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.musyrif.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Musyrif tidak ditemukan' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nik = typeof body.nik === 'string' ? body.nik.trim() : ''
    const namaLengkap = typeof body.namaLengkap === 'string' ? body.namaLengkap.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const usernameRaw = typeof body.username === 'string' ? body.username.trim() : ''

    if (!nik || !namaLengkap || !email) {
      return NextResponse.json(
        { error: 'NIK, nama lengkap, dan email wajib diisi' },
        { status: 400 }
      )
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
    }
    if (password !== '' && password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // Username: kosong = otomatis dari email; diisi = wajib unik lintas Admin & Musyrif
    const candidate = usernameRaw ? normalizeUsername(usernameRaw) : usernameFromEmail(email)
    const invalidUsername = validateUsername(candidate)
    if (invalidUsername) {
      return NextResponse.json({ error: invalidUsername }, { status: 400 })
    }
    if (candidate !== existing.username) {
      const [dupMusyrif, dupAdmin] = await Promise.all([
        db.musyrif.findFirst({
          where: { username: candidate, id: { not: id } },
          select: { id: true },
        }),
        db.admin.findUnique({ where: { username: candidate }, select: { id: true } }),
      ])
      if (dupMusyrif || dupAdmin) {
        return NextResponse.json({ error: 'Username sudah dipakai akun lain' }, { status: 409 })
      }
    }
    const username = candidate

    // Cek duplikat (kecuali milik sendiri)
    if (nik !== existing.nik) {
      const dupNik = await db.musyrif.findUnique({ where: { nik } })
      if (dupNik) {
        return NextResponse.json({ error: 'NIK sudah terdaftar' }, { status: 409 })
      }
    }
    if (email !== existing.email) {
      const dupEmail = await db.musyrif.findUnique({ where: { email } })
      if (dupEmail) {
        return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
      }
    }

    // Sinkronkan kredensial ke Supabase Auth
    try {
      if (email !== existing.email) {
        await updateAuthUserEmail(existing.authUserId, email)
      }
      if (password !== '') {
        await updateAuthUserPassword(existing.authUserId, password)
      }
    } catch (e) {
      return NextResponse.json({ error: extractAuthError(e) }, { status: 400 })
    }

    const musyrif = await db.musyrif.update({
      where: { id },
      data: { nik, namaLengkap, email, username },
      select: musyrifSelect,
    })
    return NextResponse.json({ musyrif })
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: 'NIK, email, atau username sudah terdaftar' },
        { status: 409 }
      )
    }
    console.error('[musyrif/:id PUT]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** DELETE /api/musyrif/:id — admin. Hapus profil + user Supabase Auth-nya.
 *  Setoran terkait musyrif.musyrifId menjadi null. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.musyrif.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Musyrif tidak ditemukan' }, { status: 404 })
    }

    await db.musyrif.delete({ where: { id } })
    await deleteAuthUser(existing.authUserId).catch((e) => {
      console.error('[musyrif/:id DELETE] gagal hapus user auth:', e)
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[musyrif/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
