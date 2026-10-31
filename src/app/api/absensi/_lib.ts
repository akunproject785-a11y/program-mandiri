import type { Prisma } from '@prisma/client'
import type { AbsensiMusyrifItem, StatusAbsensi } from '@/lib/types'

/** Bucket Supabase Storage khusus foto selfie absensi (public). */
export const BUCKET_ABSENSI = 'foto-absensi'

/** Ukuran maksimal foto yang diterima server (foto sudah dikompres di klien). */
export const MAX_FOTO_SIZE = 512 * 1024 // 512 KB

export const ALLOWED_FOTO_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function isStatusAbsensi(v: unknown): v is StatusAbsensi {
  return v === 'PENDING' || v === 'ACC' || v === 'TOLAK'
}

/** Waktu sekarang zona WIB (UTC+7) → { tanggal: 'YYYY-MM-DD', jam: 'HH:MM:SS' }. */
export function wibNow(now = new Date()): { tanggal: string; jam: string } {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const iso = wib.toISOString()
  return { tanggal: iso.slice(0, 10), jam: iso.slice(11, 19) }
}

/** Tanggal Senin pada minggu yang memuat `tanggal` ('YYYY-MM-DD'). */
export function seninMinggu(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00Z`)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

/** `tanggal` ('YYYY-MM-DD') + n hari → 'YYYY-MM-DD'. */
export function tambahHari(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Hari terakhir bulan 'YYYY-MM' (mis. '2026-10' → '2026-10-31'). */
export function akhirBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map((v) => parseInt(v, 10))
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

/** Validasi format tanggal YYYY-MM-DD. */
export function isTanggalValid(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/** Validasi format bulan YYYY-MM. */
export function isBulanValid(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

/** Ambil path objek dari URL public bucket foto-absensi. */
export function objectPathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET_ABSENSI}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length).split('?')[0] || null
}

export const absensiInclude = {
  musyrif: { select: { namaLengkap: true } },
} satisfies Prisma.AbsensiMusyrifInclude

export type AbsensiWithMusyrif = Prisma.AbsensiMusyrifGetPayload<{
  include: typeof absensiInclude
}>

export function mapAbsensi(a: AbsensiWithMusyrif): AbsensiMusyrifItem {
  return {
    id: a.id,
    musyrifId: a.musyrifId,
    musyrifNama: a.musyrif?.namaLengkap ?? '',
    tanggal: a.tanggal,
    jam: a.jam,
    fotoUrl: a.fotoUrl,
    status: isStatusAbsensi(a.status) ? a.status : 'PENDING',
    keterangan: a.keterangan,
    catatanAdmin: a.catatanAdmin,
  }
}
