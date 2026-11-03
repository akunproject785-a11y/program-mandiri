import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

/**
 * Bersih-bersih data uji E2E: hapus absensi siswa pada tanggal yang diberikan
 * (arg 1, default: hari ini WIB). Setoran TIDAK disentuh di sini (dihapus
 * terpisah bila ada). Dipakai setelah uji gate absen supaya DB produksi kembali
 * seperti semula.
 */
const db = new PrismaClient()

function wibTanggal(d = new Date()) {
  const wib = new Date(d.getTime() + 7 * 3600 * 1000)
  return wib.toISOString().slice(0, 10)
}

const tanggal = process.argv[2] || wibTanggal()

const sebelum = await db.absensiSiswa.count({ where: { tanggal } })
const hapus = await db.absensiSiswa.deleteMany({ where: { tanggal } })
const sesudah = await db.absensiSiswa.count({ where: { tanggal } })
const setoran = await db.setoran.count({ where: { tanggal } })

console.log(
  `AbsensiSiswa ${tanggal}: sebelum=${sebelum}, terhapus=${hapus.count}, sesudah=${sesudah}`
)
console.log(`Setoran ${tanggal}: ${setoran}`)
console.log(sesudah === 0 && setoran === 0 ? '→ DB BERSIH ✓' : '→ MASIH ADA SISA ✗')

await db.$disconnect()
