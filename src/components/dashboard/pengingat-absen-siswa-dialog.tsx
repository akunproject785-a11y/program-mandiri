'use client'

/**
 * POPUP "Halaqoh Belum Diabsen" (khusus musyrif) — versi TERKONTROL.
 * - TIDAK muncul otomatis saat dashboard dibuka. Popup terpicu saat musyrif
 *   MEMILIH halaqoh-nya (kartu "Halaqoh Binaan Saya" di menu Ringkasan) yang
 *   belum diabsen hari ini — Dashboard yang memeriksa status absen lalu
 *   mengirim `target`.
 * - Tombol "Absen Sekarang" → Dashboard pindah ke menu Absen Siswa dan
 *   langsung membuka roster halaqoh tsb (popup absen siswa muncul setelahnya).
 * - "Nanti Saja" / tombol X / klik luar / Esc hanya menutup popup; memilih
 *   halaqoh yang sama lagi akan memunculkannya kembali selama masih belum
 *   diabsen.
 * - Pengingat di dalam form Input Setoran tetap dihapus — aturan "simpan
 *   setoran butuh absen" tetap berlaku lewat tombol simpan yang terkunci.
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

export default function PengingatAbsenSiswaDialog({
  target,
  tanggal,
  onAbsenSekarang,
  onTunda,
}: {
  /** Halaqoh terpilih yang belum diabsen (null = popup tertutup). */
  target: PengingatHalaqoh | null
  /** Tanggal "hari ini" versi server (WIB) untuk teks popup. */
  tanggal: string
  /** Tombol "Absen Sekarang" — buka menu Absen Siswa pada halaqoh target. */
  onAbsenSekarang: () => void
  /** Tutup popup tanpa pindah menu. */
  onTunda: () => void
}) {
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
          <DialogDescription>
            Belum ada absensi siswa untuk hari ini
            {tanggal ? ` (${formatTanggalIndo(tanggal)})` : ''}. Absen dulu sebelum
            mencatat setoran — setoran hanya bisa disimpan untuk siswa yang sudah
            diabsen.
          </DialogDescription>
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
