import { db } from '@/lib/db'

/** Key Setting yang menyimpan status aktivasi menu Ujian musyrif ('1' aktif). */
export const KEY_UJIAN_AKTIF = 'ujian_musyrif_aktif'

/** Baca status aktivasi menu Ujian dari tabel Setting. */
export async function bacaUjianAktif(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: KEY_UJIAN_AKTIF } })
  return row?.value === '1'
}

/**
 * Baca label tahun ajaran aktif untuk data ujian ('' berarti belum ada yang
 * aktif). Tahun ajaran dikelola di tabel TahunAjaran: admin menambah entri
 * terlebih dahulu, lalu mengaktifkan salah satu (baru maupun yang lalu).
 */
export async function bacaTahunAjaran(): Promise<string> {
  const row = await db.tahunAjaran.findFirst({
    where: { aktif: true },
    orderBy: { createdAt: 'asc' },
    select: { label: true },
  })
  return row?.label ?? ''
}
