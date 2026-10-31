import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/change-password — ganti password akun sendiri (admin & musyrif).
 * Body: {currentPassword, newPassword}. Password lama diverifikasi via
 * signInWithPassword, lalu password diperbarui via updateUser.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => ({}))) as {
      currentPassword?: unknown
      newPassword?: unknown
    }
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password saat ini dan password baru wajib diisi' },
        { status: 400 }
      )
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru minimal 6 karakter' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user?.email) {
      return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 403 })
    }

    // Verifikasi password lama
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: data.user.email,
      password: currentPassword,
    })
    if (verifyError) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 })
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/change-password]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
