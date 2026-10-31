import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import type { RekapAbsenPeriod } from '@/lib/types'
import {
  BUCKET_ABSENSI,
  akhirBulan,
  isBulanValid,
  isTanggalValid,
  objectPathFromUrl,
  seninMinggu,
  tambahHari,
} from '../../_lib'

const BULAN_NAMA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function labelBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map((v) => parseInt(v, 10))
  return `${BULAN_NAMA[m - 1]} ${y}`
}

/**
 * GET /api/absensi/admin/rekap — daftar periode absensi yang punya data,
 * dikelompokkan per minggu (Senin–Minggu) dan per bulan, urut terbaru.
 */
export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const rows = await db.absensiMusyrif.findMany({
      select: { tanggal: true },
    })

    const mingguMap = new Map<string, number>()
    const bulanMap = new Map<string, number>()
    for (const { tanggal } of rows) {
      const senin = seninMinggu(tanggal)
      mingguMap.set(senin, (mingguMap.get(senin) ?? 0) + 1)
      const bulan = tanggal.slice(0, 7)
      bulanMap.set(bulan, (bulanMap.get(bulan) ?? 0) + 1)
    }

    const toPeriod = (
      key: string,
      mulai: string,
      sampai: string,
      jumlah: number,
      minggu: boolean
    ): RekapAbsenPeriod => ({
      key,
      label: minggu
        ? `${mulai.split('-').reverse().join('/')} – ${sampai.split('-').reverse().join('/')}`
        : labelBulan(key),
      mulai,
      sampai,
      jumlah,
    })

    const minggu: RekapAbsenPeriod[] = [...mingguMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([senin, jumlah]) =>
        toPeriod(senin, senin, tambahHari(senin, 6), jumlah, true)
      )
    const bulan: RekapAbsenPeriod[] = [...bulanMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([b, jumlah]) => toPeriod(b, `${b}-01`, akhirBulan(b), jumlah, false))

    return NextResponse.json({ minggu, bulan, total: rows.length })
  } catch (e) {
    console.error('[absensi/admin/rekap GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * DELETE /api/absensi/admin/rekap — hapus seluruh absensi pada satu periode
 * BESERTA foto selfie-nya di Storage (agar penyimpanan tidak penuh).
 * Body: { tipe: 'minggu' | 'bulan', nilai: 'YYYY-MM-DD' (Senin) | 'YYYY-MM' }
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const body = (await request.json().catch(() => null)) as {
      tipe?: string
      nilai?: string
    } | null

    let mulai: string
    let sampai: string
    if (body?.tipe === 'minggu' && isTanggalValid(body.nilai)) {
      mulai = seninMinggu(body.nilai)
      sampai = tambahHari(mulai, 6)
    } else if (body?.tipe === 'bulan' && isBulanValid(body.nilai)) {
      mulai = `${body.nilai}-01`
      sampai = akhirBulan(body.nilai)
    } else {
      return NextResponse.json(
        { error: "Periode tidak valid (gunakan tipe 'minggu'/'bulan' + nilai 'YYYY-MM-DD'/'YYYY-MM')" },
        { status: 400 }
      )
    }

    const rows = await db.absensiMusyrif.findMany({
      where: { tanggal: { gte: mulai, lte: sampai } },
      select: { id: true, fotoUrl: true },
    })

    let fotoDihapus = 0
    if (rows.length > 0) {
      const storage = createSupabaseServiceClient().storage
      const paths = rows
        .map((r) => objectPathFromUrl(r.fotoUrl))
        .filter((p): p is string => Boolean(p))
      // Hapus foto dari storage per kelompok 50 (batas aman API)
      for (let i = 0; i < paths.length; i += 50) {
        const chunk = paths.slice(i, i + 50)
        const { error } = await storage.from(BUCKET_ABSENSI).remove(chunk)
        if (!error) fotoDihapus += chunk.length
      }
      await db.absensiMusyrif.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      })
    }

    return NextResponse.json({
      deleted: rows.length,
      fotoDihapus,
      periode: { mulai, sampai },
    })
  } catch (e) {
    console.error('[absensi/admin/rekap DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
