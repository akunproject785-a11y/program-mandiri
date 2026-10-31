import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hariFromTanggal } from '@/lib/format'
import { requireAuth } from '@/lib/auth'
import { mapSetoranFlat, setoranInclude, toIntOrNull, toStrOrNull } from '@/app/api/_lib/shared'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PUT /api/setoran/:id — edit setoran. Admin dapat mengubah semua setoran;
 * musyrif hanya setoran yang dia catat sendiri.
 * Field identitas (siswa, tipe, program, musyrif) TIDAK diubah — hanya isi data.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user
    const { id } = await params

    const existing = await db.setoran.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Setoran tidak ditemukan' }, { status: 404 })
    }

    if (user.role !== 'admin') {
      if (!user.musyrifId || existing.musyrifId !== user.musyrifId) {
        return NextResponse.json(
          { error: 'Anda hanya dapat mengubah setoran yang Anda catat sendiri' },
          { status: 403 }
        )
      }
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const tanggal = toStrOrNull(body.tanggal)
    if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json(
        { error: 'Tanggal wajib diisi dengan format YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const updated = await db.setoran.update({
      where: { id },
      data: {
        tanggal,
        hari: hariFromTanggal(tanggal),
        menuSetoran: toStrOrNull(body.menuSetoran),
        juz: toIntOrNull(body.juz),
        surat: toStrOrNull(body.surat),
        ayat: toStrOrNull(body.ayat),
        anaba: toStrOrNull(body.anaba),
        halaman: toStrOrNull(body.halaman),
        halamanMushaf: toStrOrNull(body.halamanMushaf),
        jumlahBaris: toIntOrNull(body.jumlahBaris),
        nilaiKelancaran: toStrOrNull(body.nilaiKelancaran),
        kualitasBacaan: toStrOrNull(body.kualitasBacaan),
        nilai: toStrOrNull(body.nilai),
        materiBelajar: toStrOrNull(body.materiBelajar),
        catatanMusyrif: toStrOrNull(body.catatanMusyrif),
      },
      include: setoranInclude,
    })

    return NextResponse.json({ setoran: mapSetoranFlat(updated) })
  } catch (e) {
    console.error('[setoran/:id PUT]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** DELETE /api/setoran/:id — admin, atau musyrif pemilik setoran (yang mencatat) */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user
    const { id } = await params

    const setoran = await db.setoran.findUnique({ where: { id } })
    if (!setoran) {
      return NextResponse.json({ error: 'Setoran tidak ditemukan' }, { status: 404 })
    }

    if (user.role !== 'admin') {
      if (!user.musyrifId || setoran.musyrifId !== user.musyrifId) {
        return NextResponse.json(
          { error: 'Anda hanya dapat menghapus setoran yang Anda catat sendiri' },
          { status: 403 }
        )
      }
    }

    await db.setoran.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[setoran/:id DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
