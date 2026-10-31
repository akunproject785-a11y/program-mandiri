import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { extractAuthError, updateAuthUserPassword } from '@/lib/supabase/accounts'

type RouteParams = { params: Promise<{ id: string }> }

/** POST /api/musyrif/:id/reset-password — admin. Body: {password}
 *  Password diubah langsung pada user Supabase Auth (service role). */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.musyrif.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Musyrif tidak ditemukan' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as { password?: unknown }
    const password = typeof body.password === 'string' ? body.password : ''
    if (!password) {
      return NextResponse.json({ error: 'Password baru wajib diisi' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    try {
      await updateAuthUserPassword(existing.authUserId, password)
    } catch (e) {
      return NextResponse.json({ error: extractAuthError(e) }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[musyrif/:id/reset-password]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
