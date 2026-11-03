import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getHalaqohIdsForMusyrif, toStrOrNull } from '@/app/api/_lib/shared'
import { wibNow } from '@/app/api/absensi/_lib'
import { STATUS_KEHADIRAN } from '@/lib/types'
import type { Prisma } from '@prisma/client'

/** Guard: fitur ini hanya untuk musyrif (menu Absen Siswa ada di dashboard musyrif). */
function guardMusyrif(role: string, musyrifId?: string) {
  if (role !== 'musyrif' || !musyrifId) {
    return NextResponse.json(
      { error: 'Hanya musyrif yang dapat mengakses absen siswa' },
      { status: 403 }
    )
  }
  return null
}

/** Tanggal 'YYYY-MM-DD' dari query (opsional) — harus valid, fallback WIB hari ini. */
function tanggalValidAtauHariIni(raw: string | null): string | null {
  if (!raw) return wibNow().tanggal
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

/** Include data siswa utk daftar absensi (urut nama biar mudah dicek saat absen). */
const rosterInclude = {
  program: { select: { nama: true } },
} satisfies Prisma.HalaqohInclude

/**
 * GET /api/absensi-siswa?halaqohId=...&tanggal=YYYY-MM-DD
 * Daftar siswa satu halaqoh + status absensi pada tanggal (default: hari ini WIB).
 * Musyrif hanya boleh membuka halaqoh binaannya.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const guard = guardMusyrif(auth.user.role, auth.user.musyrifId)
    if (guard) return guard
    const musyrifId = auth.user.musyrifId as string

    const url = new URL(request.url)
    const halaqohId = url.searchParams.get('halaqohId') || ''
    const tanggal = tanggalValidAtauHariIni(url.searchParams.get('tanggal'))
    if (!tanggal) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    }
    if (!halaqohId) {
      return NextResponse.json({ error: 'halaqohId wajib diisi' }, { status: 400 })
    }

    const scopeIds = await getHalaqohIdsForMusyrif(musyrifId)
    if (!scopeIds.includes(halaqohId)) {
      return NextResponse.json(
        { error: 'Halaqoh bukan binaan Anda' },
        { status: 403 }
      )
    }

    const halaqoh = await db.halaqoh.findUnique({
      where: { id: halaqohId },
      include: rosterInclude,
    })
    if (!halaqoh) {
      return NextResponse.json({ error: 'Halaqoh tidak ditemukan' }, { status: 404 })
    }

    const siswaRows = await db.siswa.findMany({
      where: { halaqohId },
      orderBy: { nama: 'asc' },
      select: { id: true, nis: true, nama: true, kelas: true },
    })
    const absenRows = await db.absensiSiswa.findMany({
      where: { siswaId: { in: siswaRows.map((s) => s.id) }, tanggal },
      select: { siswaId: true, status: true, keterangan: true },
    })
    const absenMap = new Map(absenRows.map((a) => [a.siswaId, a]))

    return NextResponse.json({
      tanggalServer: wibNow().tanggal,
      tanggal,
      halaqoh: {
        id: halaqoh.id,
        nama: halaqoh.nama,
        programNama: halaqoh.program.nama,
      },
      siswa: siswaRows.map((s) => {
        const a = absenMap.get(s.id)
        return {
          id: s.id,
          nis: s.nis,
          nama: s.nama,
          kelas: s.kelas,
          absen: a ? { status: a.status, keterangan: a.keterangan } : null,
        }
      }),
    })
  } catch (e) {
    console.error('[absensi-siswa GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

interface EntryInput {
  siswaId?: unknown
  status?: unknown
  keterangan?: unknown
}

/**
 * POST /api/absensi-siswa — body { halaqohId, tanggal?, entries: [{siswaId, status, keterangan?}] }.
 * Simpan absensi batch (upsert per siswa+tanggal — absen ulang = koreksi).
 * Siswa harus anggota halaqoh binaan musyrif.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const guard = guardMusyrif(auth.user.role, auth.user.musyrifId)
    if (guard) return guard
    const musyrifId = auth.user.musyrifId as string

    let body: { halaqohId?: unknown; tanggal?: unknown; entries?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Format permintaan tidak valid' }, { status: 400 })
    }

    const halaqohId = toStrOrNull(body.halaqohId)
    const tanggal = tanggalValidAtauHariIni(toStrOrNull(body.tanggal))
    if (!halaqohId) {
      return NextResponse.json({ error: 'halaqohId wajib diisi' }, { status: 400 })
    }
    if (!tanggal) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    }
    const entries = Array.isArray(body.entries) ? (body.entries as EntryInput[]) : []
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data absensi untuk disimpan' }, { status: 400 })
    }
    if (entries.length > 200) {
      return NextResponse.json({ error: 'Terlalu banyak siswa dalam satu permintaan' }, { status: 400 })
    }

    const bersih: { siswaId: string; status: string; keterangan: string | null }[] = []
    for (const e of entries) {
      const siswaId = toStrOrNull(e.siswaId)
      const status = toStrOrNull(e.status)
      if (!siswaId || !status || !(STATUS_KEHADIRAN as readonly string[]).includes(status)) {
        return NextResponse.json(
          { error: 'Status absensi tidak valid (HADIR/SAKIT/IZIN/ALPA)' },
          { status: 400 }
        )
      }
      const ket = toStrOrNull(e.keterangan)
      if (ket && ket.length > 200) {
        return NextResponse.json({ error: 'Keterangan maksimal 200 karakter' }, { status: 400 })
      }
      bersih.push({ siswaId, status, keterangan: ket })
    }

    // Musyrif hanya boleh mencatat siswa halaqoh binaannya.
    const scopeIds = await getHalaqohIdsForMusyrif(musyrifId)
    if (!scopeIds.includes(halaqohId)) {
      return NextResponse.json({ error: 'Halaqoh bukan binaan Anda' }, { status: 403 })
    }
    const anggota = await db.siswa.count({
      where: { id: { in: bersih.map((b) => b.siswaId) }, halaqohId },
    })
    if (anggota !== new Set(bersih.map((b) => b.siswaId)).size) {
      return NextResponse.json(
        { error: 'Ada siswa yang bukan anggota halaqoh ini' },
        { status: 400 }
      )
    }

    await db.$transaction(
      bersih.map((b) =>
        db.absensiSiswa.upsert({
          where: { siswaId_tanggal: { siswaId: b.siswaId, tanggal } },
          create: {
            siswaId: b.siswaId,
            halaqohId,
            tanggal,
            status: b.status,
            keterangan: b.keterangan,
            dicatatOleh: auth.user.name,
            dicatatOlehId: musyrifId,
          },
          update: {
            halaqohId,
            status: b.status,
            keterangan: b.keterangan,
            dicatatOleh: auth.user.name,
            dicatatOlehId: musyrifId,
          },
        })
      )
    )

    return NextResponse.json({ tersimpan: bersih.length, tanggal })
  } catch (e) {
    console.error('[absensi-siswa POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
