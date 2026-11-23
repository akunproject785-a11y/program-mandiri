import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

/** Batas panjang label tahun ajaran (mis. "2026/2027"). */
const MAX_PANJANG_LABEL = 30

/** Pemetaan baris TahunAjaran + jumlah data terpakai untuk daftar admin. */
async function daftarTahunAjaran() {
  const rows = await db.tahunAjaran.findMany({
    orderBy: [{ aktif: 'desc' }, { createdAt: 'asc' }],
  })
  return Promise.all(
    rows.map(async (t) => {
      const [jumlahUjian, jumlahTp] = await Promise.all([
        db.ujian.count({ where: { tahunAjaran: t.label } }),
        db.tpUjian.count({ where: { tahunAjaran: t.label } }),
      ])
      return { id: t.id, label: t.label, aktif: t.aktif, jumlahUjian, jumlahTp }
    })
  )
}

/**
 * GET /api/ujian/tahun-ajaran — daftar tahun ajaran (admin): label, status
 * aktif, dan jumlah data ujian/TP yang memakainya.
 */
export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    return NextResponse.json({ items: await daftarTahunAjaran() })
  } catch (e) {
    console.error('[ujian/tahun-ajaran GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * POST /api/ujian/tahun-ajaran — admin MENAMBAH tahun ajaran baru (belum aktif).
 * Bila belum ada tahun ajaran aktif sama sekali, entri pertama otomatis diaktifkan
 * agar alur tidak buntu; selain itu admin mengaktifkan lewat PATCH [id].
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => null)) as { label?: string } | null
    const label = body?.label?.trim().slice(0, MAX_PANJANG_LABEL)
    if (!label) {
      return NextResponse.json({ error: 'Isi label tahun ajaran (mis. "2027/2028")' }, { status: 400 })
    }

    const sudah = await db.tahunAjaran.findUnique({ where: { label } })
    if (sudah) {
      return NextResponse.json({ error: `Tahun ajaran "${label}" sudah ada` }, { status: 400 })
    }

    // Entri pertama otomatis aktif bila belum ada yang aktif.
    const adaAktif = await db.tahunAjaran.findFirst({ where: { aktif: true } })
    await db.tahunAjaran.create({ data: { label, aktif: !adaAktif } })

    return NextResponse.json({ items: await daftarTahunAjaran() }, { status: 201 })
  } catch (e) {
    console.error('[ujian/tahun-ajaran POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
