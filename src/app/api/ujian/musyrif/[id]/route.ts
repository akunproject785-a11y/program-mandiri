import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type RouteParams = { params: Promise<{ id: string }> }

/** DELETE /api/ujian/musyrif/:id — musyrif menghapus record ujian miliknya sendiri. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat menghapus ujian' }, { status: 403 })
    }
    const { id } = await params

    const existing = await db.ujian.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Data ujian tidak ditemukan' }, { status: 404 })
    }
    if (existing.musyrifId !== auth.user.musyrifId) {
      return NextResponse.json({ error: 'Anda hanya dapat menghapus ujian yang Anda catat' }, { status: 403 })
    }

    await db.ujian.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[ujian/musyrif/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
