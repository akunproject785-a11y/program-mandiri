import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type AoA = (string | number)[][]

function sheetFromAoA(aoa: AoA, cols?: { wch: number }[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  if (cols) ws['!cols'] = cols
  return ws
}

/** GET /api/siswa/template — admin. Unduh file Excel template import siswa.
 *  Sheet: Template (header+contoh), Referensi (program & halaqoh dari DB), Petunjuk. */
export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const [programs, halaqoh] = await Promise.all([
      db.program.findMany({ orderBy: { nama: 'asc' }, select: { nama: true } }),
      db.halaqoh.findMany({
        orderBy: { nama: 'asc' },
        select: { nama: true, program: { select: { nama: true } } },
      }),
    ])

    // ===== Sheet 1: Template =====
    const templateAoA: AoA = [
      ['NIS', 'Nama', 'Kelas', 'Program', 'Halaqoh (opsional)'],
      ['2025001', 'Ahmad Fauzan', '7A', programs[0]?.nama ?? 'Tahfidz Al-Quran', ''],
      ['2025002', 'Muhammad Rizki', '7A', programs[0]?.nama ?? 'Tahfidz Al-Quran', halaqoh[0]?.nama ?? ''],
      ['2025003', 'Abdullah Zaki', '7B', programs[0]?.nama ?? 'Tahfidz Al-Quran', ''],
    ]
    const wsTemplate = sheetFromAoA(templateAoA, [
      { wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 26 }, { wch: 22 },
    ])

    // ===== Sheet 2: Referensi (nama valid dari DB) =====
    const refAoA: AoA = [
      ['DAFTAR PROGRAM (wajib sesuai nama ini)'],
      ['No', 'Nama Program'],
      ...programs.map((p, i) => [i + 1, p.nama]),
      [],
      ['DAFTAR HALAQOH (opsional, wajib sesuai nama ini)'],
      ['No', 'Nama Halaqoh', 'Program'],
      ...halaqoh.map((h, i) => [i + 1, h.nama, h.program?.nama ?? '']),
    ]
    const wsRef = sheetFromAoA(refAoA, [{ wch: 6 }, { wch: 30 }, { wch: 30 }])

    // ===== Sheet 3: Petunjuk =====
    const petunjukLines = [
      ['PETUNJUK IMPORT DATA SISWA'],
      [],
      ['1. Isi data pada sheet "Template" mulai baris ke-2 (contoh boleh dihapus).'],
      ['2. Kolom wajib: NIS, Nama, Kelas, Program. Kolom Halaqoh boleh dikosongkan.'],
      ['3. Nama Program dan Halaqoh harus sama dengan daftar pada sheet "Referensi"'],
      ['   (huruf besar/kecil diabaikan, tetapi teksnya harus cocok).'],
      ['4. NIS tidak boleh duplikat (dalam file maupun dengan data siswa yang sudah ada).'],
      ['5. Simpan file (format .xlsx / .xls / .csv), lalu upload melalui menu'],
      ['   Data Siswa → tombol "Import Massal" pada aplikasi.'],
      ['6. Alternatif tanpa file: blok data di Excel → Copy (Ctrl+C) →'],
      ['   tempel (Ctrl+V) pada tab "Copy-Paste" di dialog Import Massal.'],
      [],
      ['CATATAN:'],
      ['- Baris yang kosong akan dilewati otomatis.'],
      ['- Baris dengan NIS duplikat / program tidak dikenal akan ditolak,'],
      ['  sisanya tetap diimpor (lihat ringkasan hasil setelah import).'],
    ]
    const wsPetunjuk = sheetFromAoA(petunjukLines, [{ wch: 78 }])

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template')
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi')
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': MIME_XLSX,
        'Content-Disposition': 'attachment; filename="template-import-siswa.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[siswa template GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
