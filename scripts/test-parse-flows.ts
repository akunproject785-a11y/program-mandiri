// Uji template hasil generate diparse balik oleh parseExcelFile (jalur browser yang sama)
import { buildTemplateWorkbook, parsePastedText } from '@/lib/import-siswa'

const programs = [
  { id: 'p1', kode: 'PGM-005', nama: 'Tahfidz Juz 30', tipeInputan: 'C' as const, targetHafalan: 'Juz 30' },
]
const halaqohList = [
  { id: 'h1', kode: 'HLQ-003', nama: 'Halaqoh Test 1', programId: 'p1', programNama: 'Tahfidz Juz 30', musyrif: [], jumlahSiswa: 0 },
]

// parseExcelFile butuh File (browser API) — bun punya File; buat dari bytes template
const bytes = await buildTemplateWorkbook(programs, halaqohList)
const file = new File([bytes], 'Template-Import-Data-Siswa.xlsx')
const rows = await (await import('@/lib/import-siswa')).parseExcelFile(file)
console.log('Template diparse →', rows.length, 'baris data (header otomatis dilewati):')
rows.forEach((r) => console.log(' ', JSON.stringify(r)))

// Uji parser copy-paste: TSV Excel + variasi delimiter CSV titik-koma dgn kutip
const tsv = 'NIS\tNama Lengkap\tKelas\tKode Program\tKode Halaqoh\n9301\t"Ananda, Putri"\t7A\tPGM-005\tHLQ-003\n9302\tBudi\t8B;PGM-005;'
console.log('\nTSV dgn kutip:', JSON.stringify(parsePastedText(tsv.split('\n').slice(0, 2).join('\n'))))
const csv = '9401;Anisa;7A;PGM-005;HLQ-003\n9402;Bima;8B;PGM-005;'
console.log('CSV titik-koma:', JSON.stringify(parsePastedText(csv)))
