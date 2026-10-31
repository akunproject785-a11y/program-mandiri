import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** POST /api/auth/login — PUBLIK. Body: {identifier, password}
 *  `identifier` boleh USERNAME atau EMAIL (kolom username di tabel Admin/Musyrif).
 *  Login tetap via Supabase Auth (email+password); username dipetakan ke email. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      identifier?: unknown
      email?: unknown // kompatibel dengan client lama
      password?: unknown
    }
    const raw =
      (typeof body.identifier === 'string' && body.identifier) ||
      (typeof body.email === 'string' && body.email) ||
      ''
    const identifier = raw.trim().toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Username/email dan password wajib diisi' },
        { status: 400 }
      )
    }

    // Username (tanpa '@') → cari email terkait di profil Admin/Musyrif
    let email = identifier
    if (!identifier.includes('@')) {
      const [admin, musyrif] = await Promise.all([
        db.admin.findUnique({ where: { username: identifier }, select: { email: true } }),
        db.musyrif.findUnique({ where: { username: identifier }, select: { email: true } }),
      ])
      const resolved = admin?.email ?? musyrif?.email
      if (!resolved) {
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
      }
      email = resolved
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      const msg = (error?.message ?? '').toLowerCase()
      if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
      }
      if (msg.includes('email not confirmed')) {
        return NextResponse.json({ error: 'Akun belum terverifikasi' }, { status: 401 })
      }
      if (msg.includes('too many requests') || msg.includes('over_request_rate_limit')) {
        return NextResponse.json(
          { error: 'Terlalu banyak percobaan. Coba lagi beberapa saat.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: error?.message ?? 'Login gagal. Silakan coba lagi.' },
        { status: 401 }
      )
    }

    // Cari profil terkait (role admin/musyrif)
    const [admin, musyrif] = await Promise.all([
      db.admin.findUnique({ where: { authUserId: data.user.id } }),
      db.musyrif.findUnique({ where: { authUserId: data.user.id } }),
    ])

    if (admin) {
      return NextResponse.json({
        user: { id: admin.id, name: admin.name, role: 'admin' },
      })
    }
    if (musyrif) {
      return NextResponse.json({
        user: {
          id: musyrif.id,
          name: musyrif.namaLengkap,
          role: 'musyrif',
          musyrifId: musyrif.id,
        },
      })
    }

    // User auth ada tapi tanpa profil aplikasi → tolak
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: 'Akun belum terhubung dengan profil aplikasi' },
      { status: 403 }
    )
  } catch (e) {
    console.error('[auth/login]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
