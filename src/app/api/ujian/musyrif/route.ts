import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getHalaqohIdsForMusyrif } from '../../_lib/shared'
import { bacaUjianAktif } from '../../_lib/ujian'
import { isTanggalValid } from '../../absensi/_lib'
import type { Prisma } from '@prisma/client'

/** Include data relasi untuk pemetaan UjianItem. */
const ujianInclude = {
  siswa: { select: { nama: true, halaqoh: { select: { nama: true } } } },
  musyrif: { select: { namaLengkap: true } },
} satisfies Prisma.UjianInclude

type UjianWithRelasi = Prisma.UjianGetPayload<{ include: typeof ujianInclude }>

function mapUjian(u: UjianWithRelasi) {
  return {
    id: u.id,
    musyrifId: u.musyrifId,
    musyrifNama: u.musyrif?.namaLengkap ?? '',
    siswaId: u.siswaId,
    siswaNama: u.siswa?.nama ?? '',
    halaqohNama: u.siswa?.halaqoh?.nama ?? null,
    tanggal: u.tanggal,
    jenis: u.jenis,
    bab: u.bab,
    nilai: u.nilai,
    catatan: u.catatan,
  }
}

/** GET /api/ujian/musyrif — daftar ujian milik musyrif + roster siswa halaqoh binaan. */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat mengakses menu Ujian' }, { status: 403 })
    }
    const musyrifId = auth.user.musyrifId
    const scopeIds = await getHalaqohIdsForMusyrif(musyrifId)

    const [aktif, items, siswaRows] = await Promise.all([
      bacaUjianAktif(),
      db.ujian.findMany({
        where: { musyrifId },
        orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        include: ujianInclude,
      }),
      db.siswa.findMany({
        where: { halaqohId: { in: scopeIds } },
        orderBy: { nama: 'asc' },
        select: { id: true, nama: true, kelas: true, halaqoh: { select: { nama: true } } },
      }),
    ])

    return NextResponse.json({
      aktif,
      items: items.map(mapUjian),
      siswa: siswaRows.map((s) => ({
        id: s.id,
        nama: s.nama,
        kelas: s.kelas,
        halaqohNama: s.halaqoh?.nama ?? '',
      })),
    })
  } catch (e) {
    console.error('[ujian/musyrif GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * POST /api/ujian/musyrif — catat hasil ujian siswa.
 * Body: { siswaId, tanggal, jenis, bab?, nilai, catatan? }
 * Menu Ujian harus sedang diaktifkan admin; siswa harus halaqoh binaan.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    if (auth.user.role !== 'musyrif' || !auth.user.musyrifId) {
      return NextResponse.json({ error: 'Hanya musyrif yang dapat mencatat ujian' }, { status: 403 })
    }
    const musyrifId = auth.user.musyrifId

    if (!(await bacaUjianAktif())) {
      return NextResponse.json(
        { error: 'Menu Ujian sedang dinonaktifkan admin' },
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => null)) as {
      siswaId?: string
      tanggal?: string
      jenis?: string
      bab?: string
      nilai?: number | string
      catatan?: string
    } | null

    if (!body || !body.siswaId || !isTanggalValid(body.tanggal) || !body.jenis?.trim()) {
      return NextResponse.json(
        { error: 'Siswa, tanggal, dan jenis ujian wajib diisi' },
        { status: 400 }
      )
    }

    const nilai = Number(body.nilai)
    if (!Number.isInteger(nilai) || nilai < 0 || nilai > 100) {
      return NextResponse.json({ error: 'Nilai harus angka bulat 0–100' }, { status: 400 })
    }

    // Siswa harus berada di salah satu halaqoh binaan musyrif.
    const scopeIds = await getHalaqohIdsForMusyrif(musyrifId)
    const siswa = await db.siswa.findUnique({
      where: { id: body.siswaId },
      select: { id: true, halaqohId: true, nama: true },
    })
    if (!siswa || !siswa.halaqohId || !scopeIds.includes(siswa.halaqohId)) {
      return NextResponse.json(
        { error: 'Siswa bukan anggota halaqoh binaan Anda' },
        { status: 403 }
      )
    }

    const created = await db.ujian.create({
      data: {
        musyrifId,
        siswaId: siswa.id,
        tanggal: body.tanggal,
        jenis: body.jenis.trim().slice(0, 100),
        bab: body.bab?.trim() ? body.bab.trim().slice(0, 200) : null,
        nilai,
        catatan: body.catatan?.trim() ? body.catatan.trim().slice(0, 300) : null,
      },
      include: ujianInclude,
    })

    return NextResponse.json({ ujian: mapUjian(created) }, { status: 201 })
  } catch (e) {
    console.error('[ujian/musyrif POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
