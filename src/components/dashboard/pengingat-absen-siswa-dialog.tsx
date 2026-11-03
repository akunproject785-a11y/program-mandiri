'use client'

/**
 * POPUP notifikasi "Halaqoh Belum Diabsen" (khusus musyrif):
 * - Dicek otomatis setelah dashboard termuat — sengaja MENUNGGU popup Absen
 *   Awal (selfie musyrif) selesai lewat prop `tunda`, agar dua popup tidak
 *   menumpuk saat keduanya perlu tampil (mis. pagi hari).
 * - Muncul bila ada halaqoh binaan yang belum memiliki SATU PUN catatan absen
 *   siswa hari ini (WIB, server-side). Halaqoh tanpa siswa diabaikan.
 * - Tombol "Absen Sekarang" membawa musyrif ke menu Absen Siswa (sekali klik
 *   "Tandai Semua Hadir" untuk seluruh siswa). Menutup popup ("Nanti Saja",
 *   tombol X, klik luar, Esc) mencatat flag sessionStorage per tanggal agar
 *   tidak muncul lagi hari ini di tab yang sama; flag dihapus saat logout
 *   (page.tsx) sehingga login berikutnya memunculkannya lagi selama halaqoh
 *   masih belum diabsen.
 * - Pengingat di dalam form Input Setoran telah dihapus (permintaan) —
 *   notifikasi kehadiran kini hanya lewat popup ini; aturan "simpan setoran
 *   butuh absen" tetap berlaku lewat tombol simpan yang terkunci di form.
 */
import { useEffect, useRef, useState } from 'react'
import { ClipboardCheck, Users } from 'lucide-react'
import { api } from '@/lib/client'
import { formatTanggalIndo } from '@/lib/format'
import type { UserInfo } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Key sessionStorage penanda "pengingat halaqoh belum diabsen ditutup hari ini". */
export const ABSEN_SISWA_PENGINGAT_SKIP_KEY = 'absen-siswa-pengingat-skip'

/** Satu halaqoh binaan yang belum diabsen hari ini. */
interface HalaqohBelumAbsen {
  id: string
  nama: string
  jumlahSiswa: number
}

export default function PengingatAbsenSiswaDialog({
  user,
  tunda,
  onNavigate,
}: {
  user: UserInfo
  /** true = tunggu popup lain (Absen Awal musyrif) selesai dulu. */
  tunda: boolean
  /** Pindah menu dashboard — dipakai tombol "Absen Sekarang". */
  onNavigate?: (section: 'absensi-siswa') => void
}) {
  const [open, setOpen] = useState(false)
  const [daftar, setDaftar] = useState<HalaqohBelumAbsen[]>([])
  const [tanggal, setTanggal] = useState('')
  const sudahJalanRef = useRef(false)

  // Cek status absen semua halaqoh binaan — sekali per mount, setelah popup
  // lain selesai (tunda=false). Tanggal tidak dikirim: API memakai hari ini WIB.
  useEffect(() => {
    if (user.role !== 'musyrif' || sudahJalanRef.current || tunda) return
    sudahJalanRef.current = true
    let mounted = true

    const cek = async () => {
      try {
        const { halaqoh } = await api<{ halaqoh: Array<{ id: string; nama: string }> }>(
          '/api/halaqoh'
        )
        if (!mounted || halaqoh.length === 0) return
        const belum: HalaqohBelumAbsen[] = []
        let tanggalServer = ''
        for (const h of halaqoh) {
          const d = await api<{
            tanggalServer: string
            siswa: Array<{ absen: unknown }>
          }>(`/api/absensi-siswa?halaqohId=${encodeURIComponent(h.id)}`)
          if (!mounted) return
          tanggalServer = tanggalServer || d.tanggalServer
          // "Belum diabsen" = punya siswa tapi belum ada satu pun catatan absen.
          if (d.siswa.length > 0 && d.siswa.every((s) => !s.absen)) {
            belum.push({ id: h.id, nama: h.nama, jumlahSiswa: d.siswa.length })
          }
        }
        if (!mounted || belum.length === 0 || !tanggalServer) return
        // Sudah pernah ditutup hari ini (tab ini)? Jangan ganggu lagi.
        try {
          if (sessionStorage.getItem(ABSEN_SISWA_PENGINGAT_SKIP_KEY) === tanggalServer) return
        } catch {
          /* sessionStorage tidak tersedia — tetap tampilkan */
        }
        setTanggal(tanggalServer)
        setDaftar(belum)
        setOpen(true)
      } catch {
        /* gagal cek status — jangan ganggu musyrif */
      }
    }

    void cek()
    return () => {
      mounted = false
    }
  }, [tunda, user.role])

  /** Tutup popup; tunda=true mencatat flag agar tidak muncul lagi hari ini. */
  const tutup = (tundaFlag: boolean) => {
    if (tundaFlag && tanggal) {
      try {
        sessionStorage.setItem(ABSEN_SISWA_PENGINGAT_SKIP_KEY, tanggal)
      } catch {
        /* abaikan */
      }
    }
    setOpen(false)
  }

  /** Menuju menu Absen Siswa — tanpa flag: bila reload sebelum absen selesai,
   *  pengingat muncul kembali. */
  const absenSekarang = () => {
    setOpen(false)
    onNavigate?.('absensi-siswa')
  }

  if (user.role !== 'musyrif') return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) tutup(true)
      }}
    >
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

        <ul className="space-y-2" aria-label="Daftar halaqoh yang belum diabsen">
          {daftar.map((h) => (
            <li
              key={h.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.nama}</span>
              <Badge variant="secondary" className="font-normal">
                {h.jumlahSiswa} siswa
              </Badge>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Button className="w-full" onClick={absenSekarang}>
            <ClipboardCheck className="h-4 w-4" />
            Absen Sekarang
          </Button>
          <Button variant="outline" className="w-full" onClick={() => tutup(true)}>
            Nanti Saja
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Di menu Absen Siswa seluruh siswa cukup diabsen sekali klik lewat
            &ldquo;Tandai Semua Hadir&rdquo;.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
