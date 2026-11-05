'use client'

/**
 * POPUP "Halaqoh Belum Diabsen" (khusus musyrif) — versi TERKONTROL.
 * Dipicu dari dua tempat (Dashboard yang memeriksa status absen lebih dulu):
 * - Ringkasan: musyrif memilih kartu "Halaqoh Binaan Saya" yang belum diabsen.
 * - Input Setoran: musyrif memilih halaqoh pada langkah 2 — popup menghalangi
 *   daftar siswa sampai absen tersimpan (konteks "input-setoran").
 * - Tombol "Absen Sekarang" → pindah ke menu Absen Siswa dan langsung membuka
 *   roster halaqoh tsb (popup absen siswa muncul setelahnya).
 * - "Nanti Saja" / tombol X / klik luar / Esc hanya menutup popup; memilih
 *   halaqoh yang sama lagi akan memunculkannya kembali selama masih belum
 *   diabsen.
 * - Aturan "simpan setoran butuh absen" tetap berlaku lewat tombol simpan
 *   yang terkunci.
 */
import { ClipboardCheck, Users } from 'lucide-react'
import { formatTanggalIndo } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Halaqoh binaan yang dipilih musyrif tapi belum diabsen hari ini. */
export interface PengingatHalaqoh {
  id: string
  nama: string
  jumlahSiswa: number
}

/**
 * True bila halaqoh ini belum diabsen sama sekali hari ini: punya siswa dan
 * TIDAK ada satu pun record absen (jika sebagian sudah diabsen, biarkan lanjut
 * — sisanya bisa dilengkapi di roster absen). Dipakai bersama oleh alur
 * Ringkasan dan alur Input Setoran agar syaratnya konsisten.
 */
export function semuaSiswaBelumDiabsen(
  siswa: Array<{ absen: unknown }>,
  jumlahSiswa: number
): boolean {
  return jumlahSiswa > 0 && siswa.length > 0 && siswa.every((s) => !s.absen)
}

export default function PengingatAbsenSiswaDialog({
  target,
  tanggal,
  konteks = 'ringkasan',
  onAbsenSekarang,
  onTunda,
}: {
  /** Halaqoh terpilih yang belum diabsen (null = popup tertutup). */
  target: PengingatHalaqoh | null
  /** Tanggal "hari ini" versi server (WIB) untuk teks popup. */
  tanggal: string
  /** "input-setoran" = dipicu dari langkah pilih halaqoh pada Input Setoran. */
  konteks?: 'ringkasan' | 'input-setoran'
  /** Tombol "Absen Sekarang" — buka menu Absen Siswa pada halaqoh target. */
  onAbsenSekarang: () => void
  /** Tutup popup tanpa pindah menu. */
  onTunda: () => void
}) {
  const deskripsi =
    konteks === 'input-setoran'
      ? `Siswa ${target?.nama ?? 'halaqoh ini'} belum diabsen hari ini${
          tanggal ? ` (${formatTanggalIndo(tanggal)})` : ''
        }. Lakukan absen siswa terlebih dahulu — daftar siswa untuk input setoran baru terbuka setelah absen tersimpan.`
      : `Belum ada absensi siswa untuk hari ini${
          tanggal ? ` (${formatTanggalIndo(tanggal)})` : ''
        }. Absen dulu sebelum mencatat setoran — setoran hanya bisa disimpan untuk siswa yang sudah diabsen.`

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onTunda()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck
              className="h-5 w-5 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            Halaqoh Belum Diabsen
          </DialogTitle>
          <DialogDescription>{deskripsi}</DialogDescription>
        </DialogHeader>

        {target ? (
          <ul aria-label="Halaqoh yang belum diabsen">
            <li className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {target.nama}
              </span>
              <Badge variant="secondary" className="font-normal">
                {target.jumlahSiswa} siswa
              </Badge>
            </li>
          </ul>
        ) : null}

        <div className="space-y-2">
          <Button className="w-full" onClick={onAbsenSekarang}>
            <ClipboardCheck className="h-4 w-4" />
            Absen Sekarang
          </Button>
          <Button variant="outline" className="w-full" onClick={onTunda}>
            Nanti Saja
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Seluruh siswa cukup diabsen sekali klik lewat &ldquo;Tandai Semua
            Hadir&rdquo;.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
