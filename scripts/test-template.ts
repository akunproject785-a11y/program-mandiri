// Uji buildTemplateWorkbook dari lib TS asli (bun mendukung tsconfig paths)
import { buildTemplateWorkbook } from '@/lib/import-siswa'
import * as XLSX from 'xlsx'
import { writeFileSync, readFileSync } from 'node:fs'

const programs = [
  { id: 'p1', kode: 'PGM-005', nama: 'Tahfidz Juz 30', tipeInputan: 'C' as const, targetHafalan: 'Juz 30' },
]
const halaqohList = [
  { id: 'h1', kode: 'HLQ-003', nama: 'Halaqoh Test 1', programId: 'p1', programNama: 'Tahfidz Juz 30', musyrif: [], jumlahSiswa: 0 },
]

const bytes = await buildTemplateWorkbook(programs, halaqohList)
writeFileSync('/tmp/template-test.xlsx', bytes)
console.log('OK tulis /tmp/template-test.xlsx,', bytes.length, 'bytes')

const buf = readFileSync('/tmp/template-test.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })
console.log('Sheets:', wb.SheetNames)
const data = XLSX.utils.sheet_to_json(wb.Sheets['Data Siswa'], { header: 1 })
console.log('Data Siswa rows:')
data.forEach((r) => console.log(' ', JSON.stringify(r)))
const ref = XLSX.utils.sheet_to_json(wb.Sheets['Referensi'], { header: 1 })
console.log('Referensi baris pertama:', JSON.stringify(ref.slice(0, 5)))
