import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/** Batas jumlah TP per kiriman dan panjang teks TP. */
const MAX_TP_PER_POST = 30
const MAX_PANJANG_TEKS = 200

/**
 * POST /api/ujian/tp — simpan Tujuan Pembelajaran (TP) milik musyrif.
 * Body: { teks: string[] } — musyrif menambah TP satu set sekaligus.
 * Minimal 2 TP tersimpan diperiksa saat pencatatan ujian (bukan di sini),
 * agar musyrif bisa menambah TP bertahap.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat mengelola TP' }, { status: 403 })
    }
    const musyrifId = auth.user.musyrifId

    const body = (await request.json().catch(() => null)) as { teks?: unknown } | null
    const mentah = Array.isArray(body?.teks) ? (body?.teks as unknown[]) : []
    const bersih = [
      ...new Set(
        mentah
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim().slice(0, MAX_PANJANG_TEKS))
          .filter((t) => t.length > 0)
      ),
    ]

    if (bersih.length === 0) {
      return NextResponse.json({ error: 'Isi minimal satu deskripsi TP' }, { status: 400 })
    }
    if (bersih.length > MAX_TP_PER_POST) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_TP_PER_POST} TP per kiriman` },
        { status: 400 }
      )
    }

    // Urutan lanjutan per musyrif agar penomoran TP deterministik
    // (createMany menghasilkan createdAt identik — jangan andalkan itu).
    const maks = await db.tpUjian.aggregate({
      where: { musyrifId },
      _max: { urutan: true },
    })
    let urutan = (maks._max.urutan ?? 0) + 1
    for (const teks of bersih) {
      await db.tpUjian.create({ data: { musyrifId, teks, urutan: urutan++ } })
    }

    const tpRows = await db.tpUjian.findMany({
      where: { musyrifId },
      orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, teks: true, _count: { select: { nilaiTp: true } } },
    })
    return NextResponse.json(
      { tp: tpRows.map((t) => ({ id: t.id, teks: t.teks, dipakai: t._count.nilaiTp > 0 })) },
      { status: 201 }
    )
  } catch (e) {
    console.error('[ujian/tp POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
