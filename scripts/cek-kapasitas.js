/**
 * Cek kapasitas: ukuran database Supabase, ukuran per tabel, dan jumlah baris.
 * Dipakai untuk analisis limit (skenario 20 musyrif / 150 siswa).
 */
const { PrismaClient } = require('@prisma/client')

async function main() {
  const db = new PrismaClient()

  const size = await db.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) AS ukuran, pg_database_size(current_database()) AS byte`
  console.log('DB_TOTAL:', JSON.stringify(size[0]))

  const tabel = await db.$queryRaw`
    SELECT relname AS tabel,
           pg_size_pretty(pg_total_relation_size(relid)) AS ukuran,
           n_live_tup AS baris
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 10`
  console.log('TABEL:')
  for (const t of tabel) console.log(`  ${t.tabel}: ${t.ukuran} | baris~${t.baris}`)

  const hitung = {}
  hitung.setoran = await db.setoran.count()
  hitung.absensiMusyrif = await db.absensiMusyrif.count()
  hitung.absensiSiswa = await db.absensiSiswa.count()
  hitung.siswa = await db.siswa.count()
  hitung.musyrif = await db.musyrif.count()
  hitung.user = await db.user.count()
  console.log('JUMLAH_BARIS:', JSON.stringify(hitung))

  const rataSetoran = await db.$queryRaw`
    SELECT pg_size_pretty(avg(pg_column_size(s))::bigint) AS rata_byte FROM "Setoran" s`
  console.log('RATA_BARIS_SETORAN:', JSON.stringify(rataSetoran[0]))

  await db.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
