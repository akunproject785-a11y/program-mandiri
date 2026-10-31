// Uji roundtrip: buat file xlsx uji + verifikasi template generator tidak error
import * as XLSX from 'xlsx'
import { writeFileSync, readFileSync } from 'node:fs'

// 1) Simulasi file upload user (dengan header + 1 baris error kosong nama)
const aoa = [
  ['NIS', 'Nama Lengkap', 'Kelas', 'Kode Program', 'Kode Halaqoh'],
  ['9101', 'Uji Upload A', '7A', 'PGM-005', 'HLQ-003'],
  ['9102', 'Uji Upload B', '8B', 'PGM-005', ''],
  ['9103', '', '7A', 'PGM-005', ''], // error: nama kosong
]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Data Siswa')
writeFileSync('/tmp/test-import.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }))
console.log('OK tulis /tmp/test-import.xlsx')

// 2) Baca balik — cek nilai terbaca (simulasi parseExcelFile)
const wb2 = XLSX.read(readFileSync('/tmp/test-import.xlsx'), { type: 'buffer' })
const matrix = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1, defval: '' })
console.log('Baris terbaca:', matrix.length)
matrix.forEach((r, i) => console.log(i, JSON.stringify(r)))
