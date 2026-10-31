import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { toStrOrNull } from '@/app/api/_lib/shared'
import { absensiInclude, mapAbsensi } from '../../_lib'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PATCH /api/absensi/admin/:id — verifikasi absensi oleh admin.
 * Body: { aksi: 'ACC' | 'TOLAK', catatan?: string }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const body = (await request.json().catch(() => null)) as {
      aksi?: string
      catatan?: string
    } | null
    if (!body || (body.aksi !== 'ACC' && body.aksi !== 'TOLAK')) {
      return NextResponse.json(
        { error: "Aksi tidak valid (gunakan 'ACC' atau 'TOLAK')" },
        { status: 400 }
      )
    }

    const existing = await db.absensiMusyrif.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Data absensi tidak ditemukan' }, { status: 404 })
    }

    const updated = await db.absensiMusyrif.update({
      where: { id },
      data: {
        status: body.aksi,
        catatanAdmin: toStrOrNull(body.catatan),
        diputusOleh: auth.user.id,
        diputusPada: new Date(),
      },
      include: absensiInclude,
    })

    return NextResponse.json({ absensi: mapAbsensi(updated) })
  } catch (e) {
    console.error('[absensi/admin/:id PATCH]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
