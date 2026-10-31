import { HARI_INDO, type SetoranItem, type TipeInputan } from '@/lib/types'

/** Derive nama hari (Senin..Minggu) dari string tanggal YYYY-MM-DD (aman dari UTC shift) */
export function hariFromTanggal(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map((v) => parseInt(v, 10))
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d)
  return HARI_INDO[date.getDay()] ?? ''
}

/** Format tanggal YYYY-MM-DD → "12 Mei 2025" */
export function formatTanggalIndo(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map((v) => parseInt(v, 10))
  if (!y || !m || !d) return tanggal
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  return `${d} ${bulan[m - 1]} ${y}`
}

/** Format tanggal YYYY-MM-DD → "12 Mei" (pendek, untuk baris daftar) */
export function formatTanggalPendek(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map((v) => parseInt(v, 10))
  if (!y || !m || !d) return tanggal
  const bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ]
  return `${d} ${bulan[m - 1]}`
}

/** Tanggal hari ini dalam format YYYY-MM-DD (zona lokal) */
export function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Ringkasan 1 baris isi setoran sesuai tipe, untuk daftar rekap */
export function describeSetoran(s: SetoranItem): string {
  switch (s.tipe) {
    case 'A':
      return [
        s.anaba ? `Anaba ${s.anaba}` : 'Anaba',
        s.halaman ? `Hal. ${s.halaman}` : null,
        s.jumlahBaris ? `${s.jumlahBaris} baris` : null,
      ]
        .filter(Boolean)
        .join(' • ')
    case 'B':
      return [
        s.surat ? `${s.surat} (Juz ${s.juz})` : `Juz ${s.juz}`,
        s.ayat ? `Ayat ${s.ayat}` : null,
        s.materiBelajar,
      ]
        .filter(Boolean)
        .join(' • ')
    case 'C':
    case 'D':
      return [
        s.menuSetoran,
        s.surat ? `${s.surat} (Juz ${s.juz})` : `Juz ${s.juz}`,
        s.ayat ? `Ayat ${s.ayat}` : null,
      ]
        .filter(Boolean)
        .join(' • ')
    default:
      return '-'
  }
}

/**
 * Seperti describeSetoran, tapi TANPA nama menu setoran (jenis sudah
 * ditampilkan terpisah pada daftar catatan terakhir) + memuat halaman mushaf
 * & jumlah baris agar musyrif tahu titik lanjutan setoran C/D.
 */
export function describeSetoranLanjutan(s: SetoranItem): string {
  if (s.tipe === 'C' || s.tipe === 'D') {
    return [
      s.surat ? `${s.surat} (Juz ${s.juz})` : `Juz ${s.juz}`,
      s.ayat ? `Ayat ${s.ayat}` : null,
      s.halamanMushaf ? `Hal. ${s.halamanMushaf}` : null,
      s.jumlahBaris ? `${s.jumlahBaris} baris` : null,
    ]
      .filter(Boolean)
      .join(' • ')
  }
  return describeSetoran(s)
}

export const TIPE_DESC: Record<TipeInputan, string> = {
  A: 'Anaba, halaman, jumlah baris, nilai kelancaran & kualitas bacaan, catatan musyrif',
  B: 'Juz 1–30, surat otomatis, ayat, materi belajar, nilai',
  C: 'Juz 30/29/28/27/1, menu setoran (Ziyadah–Murojaah–Tilawah), surat, ayat, halaman mushaf, baris, nilai, catatan',
  D: 'Juz 30/29/28/27/1, menu setoran (Murojaah–Ziyadah–Tilawah), surat, ayat, halaman mushaf, baris, nilai, catatan',
}

export function getNilaiVariant(nilai?: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!nilai) return 'outline'
  if (nilai.startsWith('A')) return 'default'
  if (nilai.startsWith('B')) return 'secondary'
  if (nilai.startsWith('C')) return 'outline'
  return 'destructive'
}
