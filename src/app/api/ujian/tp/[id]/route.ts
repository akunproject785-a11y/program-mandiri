import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * DELETE /api/ujian/tp/:id — musyrif menghapus TP miliknya sendiri.
 * TP yang sudah dipakai pada nilai ujian tidak boleh dihapus (409)
 * agar riwayat breakdown nilai tetap utuh.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat mengelola TP' }, { status: 403 })
    }
    const { id } = await params

    const existing = await db.tpUjian.findUnique({
      where: { id },
      select: { id: true, musyrifId: true, _count: { select: { nilaiTp: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'TP tidak ditemukan' }, { status: 404 })
    }
    if (existing.musyrifId !== auth.user.musyrifId) {
      return NextResponse.json({ error: 'Anda hanya dapat menghapus TP milik Anda' }, { status: 403 })
    }
    if (existing._count.nilaiTp > 0) {
      return NextResponse.json(
        { error: 'TP sudah dipakai pada nilai ujian dan tidak dapat dihapus' },
        { status: 409 }
      )
    }

    await db.tpUjian.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[ujian/tp/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
