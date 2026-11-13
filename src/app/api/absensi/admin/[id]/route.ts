import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { toStrOrNull } from '@/app/api/_lib/shared'
import { BUCKET_ABSENSI, objectPathFromUrl, absensiInclude, mapAbsensi } from '../../_lib'

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

/**
 * DELETE /api/absensi/admin/:id — hapus permanen data absensi musyrif beserta
 * fotonya di Storage, sehingga absen tersebut tidak tercatat sama sekali.
 * Berbeda dengan TOLAK (record tetap ada beserta catatan penolakan).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const existing = await db.absensiMusyrif.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Data absensi tidak ditemukan' }, { status: 404 })
    }

    // Foto di Storage dihapus dulu; kegagalan diabaikan agar record tetap bisa
    // dihapus (foto yatim bisa dibersihkan manual kapan pun).
    const fotoPath = existing.fotoUrl ? objectPathFromUrl(existing.fotoUrl) : null
    if (fotoPath) {
      await createSupabaseServiceClient()
        .storage.from(BUCKET_ABSENSI)
        .remove([fotoPath])
        .catch(() => {})
    }

    await db.absensiMusyrif.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[absensi/admin/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
