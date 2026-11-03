import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function wibTanggal(d = new Date()) {
  const wib = new Date(d.getTime() + 7 * 3600 * 1000)
  return wib.toISOString().slice(0, 10)
}

const tanggal = process.argv[2] || wibTanggal()
const rows = await db.absensiSiswa.groupBy({
  by: ['halaqohId', 'tanggal'],
  where: { tanggal },
  _count: { _all: true },
})
console.log(`AbsensiSiswa tanggal ${tanggal}:`, JSON.stringify(rows))
if (rows.length === 0) console.log('→ BERSIH: tidak ada absensi pada tanggal ini')

const setoran = await db.setoran.count({ where: { tanggal } })
console.log(`Setoran tanggal ${tanggal}: ${setoran}`)

const halaqoh = await db.halaqoh.findMany({
  select: { id: true, nama: true, _count: { select: { siswa: true } } },
})
console.log('Halaqoh:', halaqoh.map((h) => `${h.nama} (${h._count.siswa} siswa)`).join(', '))

await db.$disconnect()
