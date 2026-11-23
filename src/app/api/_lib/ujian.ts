import { db } from '@/lib/db'

/** Key Setting yang menyimpan status aktivasi menu Ujian musyrif ('1' aktif). */
export const KEY_UJIAN_AKTIF = 'ujian_musyrif_aktif'

/** Baca status aktivasi menu Ujian dari tabel Setting. */
export async function bacaUjianAktif(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: KEY_UJIAN_AKTIF } })
  return row?.value === '1'
}
