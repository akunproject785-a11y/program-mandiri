'use client'

/**
 * Popup pengingat absen saat musyrif baru login:
 * - Dicek otomatis saat komponen ini terpasang (Dashboard ter-mount ulang setiap
 *   kali login) — bila musyrif BELUM absen hari ini (atau absennya DITOLAK admin),
 *   popup muncul dan musyrif bisa langsung ambil selfie tanpa pindah menu.
 * - Foto dikompres di browser (maks 720px, JPEG) sebelum diunggah — sama dengan
 *   alur di menu Absen.
 * - Bila ditunda ("Nanti Saja" / ditutup), popup tidak muncul lagi pada hari yang
 *   sama di tab yang sama (flag sessionStorage); flag dihapus saat logout sehingga
 *   login ulang memunculkan popup kembali.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { compressImageFile, formatBytes, type CompressResult } from '@/lib/image-compress'
import { formatTanggalIndo } from '@/lib/format'
import type { AbsensiMusyrifItem, UserInfo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Key sessionStorage penanda "popup absen ditunda hari ini" (dihapus saat logout). */
export const ABSEN_POPUP_SKIP_KEY = 'absen-popup-skip'

interface AbsenStatusResponse {
  tanggalServer: string
  hariIni: AbsensiMusyrifItem | null
  items: AbsensiMusyrifItem[]
}

export default function AbsenAwalDialog({ user }: { user: UserInfo }) {
  const [open, setOpen] = useState(false)
  const [ditolak, setDitolak] = useState(false)
  const [catatanAdmin, setCatatanAdmin] = useState<string | null>(null)
  const [tanggal, setTanggal] = useState('')

  const [pending, setPending] = useState<CompressResult | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [keterangan, setKeterangan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const kameraRef = useRef<HTMLInputElement>(null)
  const previewUrlLama = useRef<string | null>(null)

  // ===== Cek status absen saat musyrif masuk dashboard =====
  useEffect(() => {
    let mounted = true
    api<AbsenStatusResponse>('/api/absensi/musyrif')
      .then((res) => {
        if (!mounted) return
        const hariIni = res.hariIni
        const perluAbsen = !hariIni || hariIni.status === 'TOLAK'
        if (!perluAbsen) return
        // Sudah pernah ditunda hari ini (tab ini)? Jangan ganggu lagi.
        try {
          if (sessionStorage.getItem(ABSEN_POPUP_SKIP_KEY) === res.tanggalServer) return
        } catch {
          /* sessionStorage tidak tersedia — tetap tampilkan */
        }
        setTanggal(res.tanggalServer)
        setDitolak(hariIni?.status === 'TOLAK')
        setCatatanAdmin(hariIni?.catatanAdmin ?? null)
        setOpen(true)
      })
      .catch(() => {
        /* gagal cek status — jangan ganggu musyrif */
      })
    return () => {
      mounted = false
    }
  }, [])

  /** Tutup popup; tunda=true mencatat flag agar tidak muncul lagi hari ini. */
  const tutup = useCallback(
    (tunda: boolean) => {
      if (tunda && tanggal) {
        try {
          sessionStorage.setItem(ABSEN_POPUP_SKIP_KEY, tanggal)
        } catch {
          /* abaikan */
        }
      }
      setOpen(false)
    },
    [tanggal]
  )

  // Bersihkan URL preview saat unmount
  useEffect(() => {
    return () => {
      if (previewUrlLama.current) URL.revokeObjectURL(previewUrlLama.current)
    }
  }, [])

  const terapkanFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG/PNG/WebP).')
      return
    }
    setCompressing(true)
    try {
      const hasil = await compressImageFile(file)
      if (previewUrlLama.current) URL.revokeObjectURL(previewUrlLama.current)
      previewUrlLama.current = hasil.previewUrl
      setPending(hasil)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCompressing(false)
    }
  }

  const batalPilih = () => {
    if (previewUrlLama.current) {
      URL.revokeObjectURL(previewUrlLama.current)
      previewUrlLama.current = null
    }
    setPending(null)
    setKeterangan('')
  }

  const kirimAbsen = async () => {
    if (!pending) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', new File([pending.blob], 'selfie.jpg', { type: 'image/jpeg' }))
      if (keterangan.trim()) fd.append('keterangan', keterangan.trim())
      const res = await fetch('/api/absensi/musyrif', { method: 'POST', body: fd })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Gagal mengirim absensi')
      toast.success('Absensi terkirim', {
        description: 'Menunggu verifikasi admin.',
      })
      if (previewUrlLama.current) {
        URL.revokeObjectURL(previewUrlLama.current)
        previewUrlLama.current = null
      }
      setPending(null)
      setKeterangan('')
      // Absen berhasil — tutup tanpa flag tunda (status hari ini sudah terisi).
      setOpen(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const hemat =
    pending && pending.originalSize > 0
      ? Math.max(0, Math.round((1 - pending.compressedSize / pending.originalSize) * 100))
      : 0

  // Hanya untuk musyrif
  if (user.role !== 'musyrif') return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) tutup(true)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {ditolak ? 'Absen Ditolak — Mohon Absen Ulang' : 'Jangan Lupa Absen!'}
          </DialogTitle>
          <DialogDescription>
            {ditolak ? (
              <>
                Absen Anda hari ini ditolak admin. Silakan ambil selfie ulang sebagai
                bukti kehadiran.
              </>
            ) : (
              <>
                Anda belum absen hari ini
                {tanggal ? ` (${formatTanggalIndo(tanggal)})` : ''}. Ambil foto selfie
                sebagai bukti kehadiran sebelum mulai mengajar.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {ditolak && catatanAdmin ? (
          <p className="rounded-md bg-muted px-2.5 py-2 text-xs">
            Catatan admin: {catatanAdmin}
          </p>
        ) : null}

        {pending ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <img
                src={pending.previewUrl}
                alt="Preview selfie"
                className="h-24 w-24 rounded-lg border object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="font-medium">Foto siap dikirim</p>
                <p className="text-muted-foreground">
                  {formatBytes(pending.originalSize)} →{' '}
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {formatBytes(pending.compressedSize)}
                  </span>{' '}
                  {hemat > 0 ? `(hemat ${hemat}%)` : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pending.width}×{pending.height} px • JPEG
                </p>
              </div>
            </div>
            <Input
              placeholder="Keterangan (opsional) — mis. mengajar halaqoh A"
              value={keterangan}
              maxLength={200}
              onChange={(e) => setKeterangan(e.target.value)}
              disabled={submitting}
            />
            <div className="flex gap-2">
              <Button onClick={kirimAbsen} disabled={submitting} className="flex-1">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Mengirim…
                  </span>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Kirim Absen
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={batalPilih} disabled={submitting}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => kameraRef.current?.click()}
              disabled={compressing}
            >
              <Camera className="h-4 w-4" />
              {compressing ? 'Mengompres…' : 'Buka Kamera & Absen'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => tutup(true)}
              disabled={submitting || compressing}
            >
              Nanti Saja
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Foto dikompres otomatis agar ringan. Absen akan diverifikasi admin.
            </p>
          </div>
        )}

        {/* Input kamera (capture=depan) — tersembunyi */}
        <input
          ref={kameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            void terapkanFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
