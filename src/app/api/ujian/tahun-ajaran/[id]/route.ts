import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { KEY_UJIAN_AKTIF } from '../../../_lib/ujian'

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
 * DELETE /api/ujian/tahun-ajaran/[id] — hapus tahun ajaran BESERTA seluruh
 * data ujian & TP miliknya (database ujian untuk tahun ajaran itu ikut kosong).
 * Bila yang dihapus TA aktif: TA lain (terlama) otomatis diaktifkan sebagai
 * pengganti; bila itu satu-satunya, menu Ujian musyrif otomatis dinonaktifkan
 * agar musyrif tidak memakai sistem tanpa tahun ajaran.
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

    const [jumlahUjian, jumlahTp] = await Promise.all([
      db.ujian.count({ where: { tahunAjaran: target.label } }),
      db.tpUjian.count({ where: { tahunAjaran: target.label } }),
    ])

    await db.$transaction([
      db.ujian.deleteMany({ where: { tahunAjaran: target.label } }),
      db.tpUjian.deleteMany({ where: { tahunAjaran: target.label } }),
      db.tahunAjaran.delete({ where: { id } }),
    ])

    // TA yang dihapus adalah yang aktif → jaga keadaan yang konsisten setelahnya.
    if (target.aktif) {
      const pengganti = await db.tahunAjaran.findFirst({ orderBy: { createdAt: 'asc' } })
      if (pengganti) {
        await db.tahunAjaran.update({ where: { id: pengganti.id }, data: { aktif: true } })
      } else {
        // Satu-satunya TA → tidak ada data ujian yang dipakai; matikan menu musyrif.
        await db.setting.upsert({
          where: { key: KEY_UJIAN_AKTIF },
          create: { key: KEY_UJIAN_AKTIF, value: '0' },
          update: { value: '0' },
        })
      }
    }

    return NextResponse.json({ ok: true, terhapus: { ujian: jumlahUjian, tp: jumlahTp } })
  } catch (e) {
    console.error('[ujian/tahun-ajaran DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
