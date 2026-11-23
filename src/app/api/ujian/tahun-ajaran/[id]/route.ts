import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

/**
 * PATCH /api/ujian/tahun-ajaran/[id] — admin MENGAKTIFKAN tahun ajaran pilihan
 * (baru maupun yang lalu). Tepat satu tahun ajaran aktif; data TP & ujian yang
 * digunakan berpindah ke tahun ajaran ini — data tahun ajaran lain tetap
 * tersimpan dan dapat diaktifkan kembali.
 */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const target = await db.tahunAjaran.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'Tahun ajaran tidak ditemukan' }, { status: 404 })
    }

    await db.$transaction([
      db.tahunAjaran.updateMany({ data: { aktif: false } }),
      db.tahunAjaran.update({ where: { id }, data: { aktif: true } }),
    ])

    return NextResponse.json({ ok: true, labelAktif: target.label })
  } catch (e) {
    console.error('[ujian/tahun-ajaran PATCH]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * DELETE /api/ujian/tahun-ajaran/[id] — hapus tahun ajaran.
 * Proteksi: tidak boleh menghapus tahun ajaran yang sedang aktif, dan tidak
 * boleh menghapus yang sudah dipakai data ujian/TP (tetap sebagai arsip).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const target = await db.tahunAjaran.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'Tahun ajaran tidak ditemukan' }, { status: 404 })
    }
    if (target.aktif) {
      return NextResponse.json(
        { error: 'Tidak bisa menghapus tahun ajaran yang sedang aktif — aktifkan tahun ajaran lain dulu' },
        { status: 400 }
      )
    }
    const [jumlahUjian, jumlahTp] = await Promise.all([
      db.ujian.count({ where: { tahunAjaran: target.label } }),
      db.tpUjian.count({ where: { tahunAjaran: target.label } }),
    ])
    if (jumlahUjian > 0 || jumlahTp > 0) {
      return NextResponse.json(
        {
          error: `Tahun ajaran "${target.label}" sudah dipakai ${jumlahUjian} ujian dan ${jumlahTp} TP — tidak dapat dihapus`,
        },
        { status: 400 }
      )
    }

    await db.tahunAjaran.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[ujian/tahun-ajaran DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
