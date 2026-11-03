/**
 * Utilitas backup/ekspor data absensi musyrif (dipakai section Rekap Absen admin).
 * - Excel: membuat file .xlsx (SheetJS) berisi 2 sheet — detail absensi & ringkasan
 *   per musyrif. Diimpor dinamis agar tidak membebani bundle awal.
 * - PDF: dicetak lewat window.print() dengan area cetak khusus (lihat komponen).
 */
import { formatTanggalIndo, hariFromTanggal } from '@/lib/format'
import type { AbsensiMusyrifItem, RekapAbsenPeriod } from '@/lib/types'

export interface RingkasanMusyrif {
  musyrifNama: string
  acc: number
  pending: number
  tolak: number
  total: number
}

/** Label status yang ramah dibaca untuk laporan. */
export function labelStatusAbsensi(status: AbsensiMusyrifItem['status']): string {
  if (status === 'ACC') return 'ACC'
  if (status === 'TOLAK') return 'Ditolak'
  return 'Menunggu ACC'
}

/** Agregasi jumlah ACC/Pending/Tolak per musyrif dari daftar absensi. */
export function agregasiPerMusyrif(items: AbsensiMusyrifItem[]): RingkasanMusyrif[] {
  const map = new Map<string, RingkasanMusyrif>()
  for (const it of items) {
    const cur =
      map.get(it.musyrifNama) ??
      { musyrifNama: it.musyrifNama, acc: 0, pending: 0, tolak: 0, total: 0 }
    if (it.status === 'ACC') cur.acc += 1
    else if (it.status === 'TOLAK') cur.tolak += 1
    else cur.pending += 1
    cur.total += 1
    map.set(it.musyrifNama, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** Nama file aman untuk unduhan, mis. Rekap-Absen-Musyrif_2026-10-26_sd_2026-11-01.xlsx */
export function namaFileAbsensi(p: RekapAbsenPeriod, ext: 'xlsx' | 'pdf'): string {
  return `Rekap-Absen-Musyrif_${p.mulai}_sd_${p.sampai}.${ext}`
}

/** Tanggal + jam cetak (WIB) untuk kop laporan. */
export function stempelWaktu(): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date())
}

/** Urutkan item: nama musyrif lalu tanggal+jam naik (untuk laporan yang rapi). */
export function urutkanAbsensi(items: AbsensiMusyrifItem[]): AbsensiMusyrifItem[] {
  return [...items].sort((a, b) => {
    if (a.musyrifNama !== b.musyrifNama) return a.musyrifNama.localeCompare(b.musyrifNama, 'id')
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal)
    return a.jam.localeCompare(b.jam)
  })
}

/**
 * Unduh rekap absensi satu periode sebagai file Excel (.xlsx).
 * Sheet 1 "Detail Absen": baris per absensi. Sheet 2 "Ringkasan": rekap per musyrif.
 */
export async function unduhExcelAbsensi(
  periode: RekapAbsenPeriod,
  items: AbsensiMusyrifItem[]
): Promise<void> {
  const XLSX = await import('xlsx')
  const data = urutkanAbsensi(items)
  const ringkasan = agregasiPerMusyrif(items)
  const stempel = stempelWaktu()

  const aoaDetail: (string | number)[][] = [
    ['REKAP ABSEN MUSYRIF'],
    [`Periode: ${periode.label} (${formatTanggalIndo(periode.mulai)} s.d. ${formatTanggalIndo(periode.sampai)})`],
    [`Dicetak: ${stempel} WIB — Program Qur'an Mandiri`],
    [],
    ['No', 'Tanggal', 'Hari', 'Jam', 'Musyrif', 'Status', 'Keterangan', 'Catatan Admin'],
    ...data.map((it, i) => [
      i + 1,
      formatTanggalIndo(it.tanggal),
      hariFromTanggal(it.tanggal),
      it.jam.slice(0, 5),
      it.musyrifNama,
      labelStatusAbsensi(it.status),
      it.keterangan ?? '',
      it.catatanAdmin ?? '',
    ]),
    [],
    [`Total: ${data.length} absensi`],
  ]

  const aoaRingkasan: (string | number)[][] = [
    ['RINGKASAN PER MUSYRIF'],
    [`Periode: ${periode.label}`],
    [],
    ['Musyrif', 'Hadir (ACC)', 'Menunggu', 'Ditolak', 'Total'],
    ...ringkasan.map((r) => [r.musyrifNama, r.acc, r.pending, r.tolak, r.total]),
    ['', '', '', 'TOTAL', data.length],
  ]

  const wb = XLSX.utils.book_new()
  const wsDetail = XLSX.utils.aoa_to_sheet(aoaDetail)
  wsDetail['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 24 },
    { wch: 13 }, { wch: 30 }, { wch: 30 },
  ]
  const wsRingkasan = XLSX.utils.aoa_to_sheet(aoaRingkasan)
  wsRingkasan['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Absen')
  XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan')

  XLSX.writeFile(wb, namaFileAbsensi(periode, 'xlsx'))
}
