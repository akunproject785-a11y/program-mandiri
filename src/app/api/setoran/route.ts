import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { hariFromTanggal } from '@/lib/format'
import { requireAuth } from '@/lib/auth'
import {
  getHalaqohIdsForMusyrif,
  isTipeValid,
  mapSetoranFlat,
  setoranInclude,
  toIntOrNull,
  toStrOrNull,
} from '@/app/api/_lib/shared'

/** GET /api/setoran — auth + filter query: siswaId, halaqohId, programId, tipe, from, to, limit */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const url = new URL(request.url)
    const siswaId = url.searchParams.get('siswaId') || undefined
    const halaqohId = url.searchParams.get('halaqohId') || undefined
    const programId = url.searchParams.get('programId') || undefined
    const tipe = url.searchParams.get('tipe') || undefined
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const limitParam = parseInt(url.searchParams.get('limit') || '', 10)
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 200

    const where: Prisma.SetoranWhereInput = {}
    if (siswaId) where.siswaId = siswaId
    if (halaqohId) where.siswa = { halaqohId }
    if (programId) where.programId = programId
    if (tipe) where.tipe = tipe
    if (from || to) {
      where.tanggal = {}
      if (from) where.tanggal.gte = from
      if (to) where.tanggal.lte = to
    }

    // Scoping musyrif: setoran siswa halaqoh binaannya ATAU yang dia catat sendiri
    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      where.AND = [
        {
          OR: [
            { siswa: { halaqohId: { in: scopeIds } } },
            { musyrifId: user.musyrifId },
          ],
        },
      ]
    }

    const rows = await db.setoran.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: setoranInclude,
    })
    return NextResponse.json({ setoran: rows.map(mapSetoranFlat) })
  } catch (e) {
    console.error('[setoran GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** POST /api/setoran — auth. Server derive hari dari tanggal, programId dari siswa, musyrifId dari session */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const user = auth.user

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const siswaId = toStrOrNull(body.siswaId)
    const tipe = body.tipe
    const tanggal = toStrOrNull(body.tanggal)

    if (!siswaId) {
      return NextResponse.json({ error: 'Siswa wajib dipilih' }, { status: 400 })
    }
    if (!isTipeValid(tipe)) {
      return NextResponse.json(
        { error: 'Tipe setoran tidak valid (harus A, B, C, atau D)' },
        { status: 400 }
      )
    }
    if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json(
        { error: 'Tanggal wajib diisi dengan format YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const siswa = await db.siswa.findUnique({ where: { id: siswaId } })
    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 400 })
    }

    // Musyrif hanya boleh mencatat untuk siswa halaqoh binaannya
    let musyrifId: string | null = null
    if (user.role === 'musyrif' && user.musyrifId) {
      const scopeIds = await getHalaqohIdsForMusyrif(user.musyrifId)
      if (!siswa.halaqohId || !scopeIds.includes(siswa.halaqohId)) {
        return NextResponse.json(
          { error: 'Siswa bukan bagian dari halaqoh binaan Anda' },
          { status: 403 }
        )
      }
      musyrifId = user.musyrifId
    }
    // Admin → musyrifId tetap null

    const created = await db.setoran.create({
      data: {
        tipe,
        siswaId,
        programId: siswa.programId,
        musyrifId,
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
    })

    const setoran = await db.setoran.findUnique({
      where: { id: created.id },
      include: setoranInclude,
    })
    if (!setoran) {
      return NextResponse.json({ error: 'Gagal menyimpan setoran' }, { status: 500 })
    }
    return NextResponse.json({ setoran: mapSetoranFlat(setoran) })
  } catch (e) {
    console.error('[setoran POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
