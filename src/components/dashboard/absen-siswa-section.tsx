'use client'

/**
 * Section "Absen Siswa" (musyrif): absensi kehadiran harian siswa per halaqoh.
 * - Kartu per halaqoh binaan menampilkan progres absen hari ini (X dari Y siswa).
 * - Notifikasi pengingat: saat membuka halaqoh yang BELUM diabsen hari ini, muncul
 *   dialog "Absen Sekarang / Nanti Saja" (permintaan: beri notifikasi ketika guru
 *   mau masuk halaqoh). "Nanti Saja" ditandai sessionStorage per halaqoh+tanggal
 *   agar tidak muncul berulang di sesi yang sama.
 * - Roster absen: semua siswa default HADIR, ubah ke SAKIT/IZIN/ALPA bila perlu
 *   (+ keterangan). Simpan = upsert batch; absen ulang di hari sama mengoreksi.
 * - Data absensi ikut tampil di Rekapan Bulanan (menu Rekap Setoran).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarCheck2,
  ClipboardCheck,
  Inbox,
  RefreshCw,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { formatTanggalIndo } from '@/lib/format'
import {
  STATUS_KEHADIRAN,
  type AbsensiSiswaData,
  type AbsensiSiswaStatusData,
  type AbsensiSiswaStatusItem,
  type StatusKehadiran,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, LoadingBlock, SectionHeader } from '@/components/dashboard/ui-helpers'

/** Key sessionStorage "pengingat absen halaqoh ini ditunda hari ini". */
function skipKey(halaqohId: string, tanggal: string): string {
  return `absen-siswa-skip-${halaqohId}-${tanggal}`
}

/** Warna badge status kehadiran. */
const STATUS_BEDGE: Record<StatusKehadiran, string> = {
  HADIR: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SAKIT: 'bg-amber-100 text-amber-700 border-amber-200',
  IZIN: 'bg-sky-100 text-sky-700 border-sky-200',
  ALPA: 'bg-red-100 text-red-700 border-red-200',
}

/** Satu chip pilihan status kehadiran pada roster. */
function StatusChip({
  status,
  aktif,
  onPilih,
}: {
  status: StatusKehadiran
  aktif: boolean
  onPilih: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onPilih}
      className={`min-h-9 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
        aktif
          ? STATUS_BEDGE[status]
          : 'border-border bg-background text-muted-foreground hover:bg-muted'
      }`}
    >
      {status}
    </button>
  )
}

/** Entri absen satu siswa pada roster (kartu agar enak disentuh di HP). */
function BarisSiswa({
  nis,
  nama,
  kelas,
  status,
  keterangan,
  onStatus,
  onKeterangan,
}: {
  nis: string
  nama: string
  kelas: string
  status: StatusKehadiran
  keterangan: string
  onStatus: (s: StatusKehadiran) => void
  onKeterangan: (v: string) => void
}) {
  return (
    <Card className={`gap-0 p-3 ${status === 'HADIR' ? '' : 'border-amber-300 bg-amber-50/40'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{nama}</p>
          <p className="text-xs text-muted-foreground">
            NIS {nis} • Kelas {kelas}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_KEHADIRAN.map((s) => (
            <StatusChip key={s} status={s} aktif={status === s} onPilih={() => onStatus(s)} />
          ))}
        </div>
      </div>
      {status !== 'HADIR' && (
        <Input
          value={keterangan}
          onChange={(e) => onKeterangan(e.target.value)}
          placeholder={`Keterangan ${status.toLowerCase()} (opsional)`}
          maxLength={200}
          className="mt-2 min-h-9"
          aria-label={`Keterangan untuk ${nama}`}
        />
      )}
    </Card>
  )
}

export default function AbsenSiswaSection() {
  const [statusList, setStatusList] = useState<AbsensiSiswaStatusItem[] | null>(null)
  const [tanggal, setTanggal] = useState('')
  const [memuatUlang, setMemuatUlang] = useState(false)

  // Roster
  const [aktif, setAktif] = useState<AbsensiSiswaStatusItem | null>(null)
  const [roster, setRoster] = useState<AbsensiSiswaData | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [entri, setEntri] = useState<Record<string, { status: StatusKehadiran; keterangan: string }>>({})
  const [menyimpan, setMenyimpan] = useState(false)

  // Dialog notifikasi pengingat absen
  const [notif, setNotif] = useState<AbsensiSiswaStatusItem | null>(null)

  const muatStatus = useCallback(async (diam = false) => {
    if (!diam) setStatusList(null)
    try {
      const res = await api<AbsensiSiswaStatusData>('/api/absensi-siswa/status')
      setTanggal(res.tanggalServer)
      setStatusList(res.items)
    } catch (e) {
      if (!diam) setStatusList([])
      toast.error(e instanceof Error ? e.message : 'Gagal memuat status absen')
    }
  }, [])

  useEffect(() => {
    void muatStatus()
  }, [muatStatus])

  const masukRoster = useCallback(async (h: AbsensiSiswaStatusItem) => {
    setAktif(h)
    setRoster(null)
    setRosterError(null)
    try {
      const res = await api<AbsensiSiswaData>(
        `/api/absensi-siswa?halaqohId=${encodeURIComponent(h.id)}`
      )
      setRoster(res)
      // Default HADIR untuk siswa yang belum punya record pada tanggal tsb.
      const awal: Record<string, { status: StatusKehadiran; keterangan: string }> = {}
      for (const s of res.siswa) {
        awal[s.id] = {
          status: s.absen?.status ?? 'HADIR',
          keterangan: s.absen?.keterangan ?? '',
        }
      }
      setEntri(awal)
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : 'Gagal memuat data siswa')
    }
  }, [])

  /** Buka roster halaqoh — dengan notifikasi pengingat bila belum diabsen hari ini. */
  const bukaHalaqoh = useCallback(
    (h: AbsensiSiswaStatusItem) => {
      const belumLengkap = h.jumlahAbsen < h.jumlahSiswa
      const sudahDitunda =
        typeof window !== 'undefined' &&
        window.sessionStorage.getItem(skipKey(h.id, tanggal)) === '1'
      if (belumLengkap && !sudahDitunda) {
        setNotif(h)
        return
      }
      void masukRoster(h)
    },
    [tanggal, masukRoster]
  )

  const tutupRoster = () => {
    setAktif(null)
    setRoster(null)
    setEntri({})
    void muatStatus(true)
  }

  const simpan = async () => {
    if (!roster || !aktif) return
    setMenyimpan(true)
    try {
      const res = await api<{ tersimpan: number }>('/api/absensi-siswa', {
        method: 'POST',
        body: {
          halaqohId: roster.halaqoh.id,
          tanggal: roster.tanggal,
          entries: roster.siswa.map((s) => ({
            siswaId: s.id,
            status: entri[s.id]?.status ?? 'HADIR',
            keterangan: entri[s.id]?.keterangan?.trim() || null,
          })),
        },
      })
      toast.success(`Absensi ${res.tersimpan} siswa ${roster.halaqoh.nama} tersimpan`)
      tutupRoster()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan absensi')
    } finally {
      setMenyimpan(false)
    }
  }

  const semuaHadir = () => {
    setEntri((prev) => {
      const next: typeof prev = {}
      for (const k of Object.keys(prev)) next[k] = { status: 'HADIR', keterangan: '' }
      return next
    })
    toast.info('Semua siswa ditandai HADIR')
  }

  const terimaNotif = (langsungAbsen: boolean) => {
    const h = notif
    if (!h) return
    if (!langsungAbsen) {
      window.sessionStorage.setItem(skipKey(h.id, tanggal), '1')
    }
    setNotif(null)
    void masukRoster(h)
  }

  const rekapStatus = useMemo(() => {
    const c: Record<StatusKehadiran, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0 }
    for (const s of roster?.siswa ?? []) {
      const st = entri[s.id]?.status ?? 'HADIR'
      c[st] += 1
    }
    return c
  }, [roster, entri])

  // ===== Render =====
  if (aktif) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title={`Absen Siswa — ${aktif.nama}`}
          description={
            roster
              ? `${roster.halaqoh.programNama} • ${formatTanggalIndo(roster.tanggal)}`
              : 'Memuat data siswa…'
          }
        >
          <Button variant="outline" onClick={tutupRoster} className="min-h-10">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </SectionHeader>

        {rosterError ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
            title="Gagal memuat"
            description={rosterError}
          >
            <Button variant="outline" onClick={() => void masukRoster(aktif)}>
              Coba Lagi
            </Button>
          </EmptyState>
        ) : !roster ? (
          <LoadingBlock label="Memuat daftar siswa…" />
        ) : roster.siswa.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
            title="Belum ada siswa"
            description={`Halaqoh ${aktif.nama} belum memiliki anggota siswa.`}
          />
        ) : (
          <>
            {/* Ringkasan live + aksi cepat */}
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_KEHADIRAN.map((s) => (
                <Badge key={s} variant="outline" className={STATUS_BEDGE[s]}>
                  {s}: {rekapStatus[s]}
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={semuaHadir} className="ml-auto min-h-9">
                <RefreshCw className="h-4 w-4" /> Tandai Semua Hadir
              </Button>
            </div>

            <div className="space-y-2">
              {roster.siswa.map((s) => (
                <BarisSiswa
                  key={s.id}
                  nis={s.nis}
                  nama={s.nama}
                  kelas={s.kelas}
                  status={entri[s.id]?.status ?? 'HADIR'}
                  keterangan={entri[s.id]?.keterangan ?? ''}
                  onStatus={(st) =>
                    setEntri((prev) => ({
                      ...prev,
                      [s.id]: { status: st, keterangan: st === 'HADIR' ? '' : (prev[s.id]?.keterangan ?? '') },
                    }))
                  }
                  onKeterangan={(v) =>
                    setEntri((prev) => ({
                      ...prev,
                      [s.id]: { status: prev[s.id]?.status ?? 'HADIR', keterangan: v },
                    }))
                  }
                />
              ))}
            </div>

            <div className="sticky bottom-4 z-10">
              <Button onClick={simpan} disabled={menyimpan} className="w-full min-h-11 text-base">
                <Send className="h-4 w-4" />
                {menyimpan ? 'Menyimpan…' : 'Simpan Absensi'}
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ===== Daftar halaqoh binaan =====
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Absen Siswa"
        description={
          tanggal
            ? `Kehadiran siswa halaqoh binaan Anda — ${formatTanggalIndo(tanggal)}`
            : 'Kehadiran siswa halaqoh binaan Anda hari ini'
        }
      >
        <Button
          variant="outline"
          onClick={() => {
            setMemuatUlang(true)
            void muatStatus(true).finally(() => setMemuatUlang(false))
          }}
          className="min-h-10"
          aria-label="Muat ulang status absen"
        >
          <RefreshCw className={`h-4 w-4 ${memuatUlang ? 'animate-spin' : ''}`} /> Muat Ulang
        </Button>
      </SectionHeader>

      {!statusList ? (
        <LoadingBlock label="Memuat halaqoh binaan…" />
      ) : statusList.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
          title="Belum ada halaqoh binaan"
          description="Anda belum ditugaskan sebagai musyrif di halaqoh mana pun. Hubungi admin."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {statusList.map((h) => {
            const selesai = h.jumlahAbsen >= h.jumlahSiswa && h.jumlahSiswa > 0
            return (
              <Card key={h.id} className="gap-0 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{h.nama}</p>
                    <p className="text-xs text-muted-foreground">{h.programNama}</p>
                  </div>
                  {selesai ? (
                    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
                      Sudah diabsen
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                      {h.jumlahSiswa === 0 ? 'Belum ada siswa' : 'Belum diabsen'}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {h.jumlahSiswa} siswa
                  {h.jumlahSiswa > 0 && ` • ${h.jumlahAbsen} sudah diabsen hari ini`}
                </p>
                <Button
                  onClick={() => bukaHalaqoh(h)}
                  disabled={h.jumlahSiswa === 0}
                  className="mt-3 w-full min-h-10"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {selesai ? 'Lihat / Koreksi Absensi' : 'Masuk Halaqoh & Absen'}
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===== Dialog notifikasi pengingat absen ===== */}
      <Dialog open={notif !== null} onOpenChange={(o) => !o && terimaNotif(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5 text-amber-600" />
              Absen {notif?.nama} belum lengkap
            </DialogTitle>
            <DialogDescription>
              {notif && notif.jumlahAbsen === 0
                ? `Halaqoh ${notif.nama} belum diabsen hari ini${tanggal ? ` (${formatTanggalIndo(tanggal)})` : ''}. Lakukan absen kehadiran siswa sekarang?`
                : `Baru ${notif?.jumlahAbsen ?? 0} dari ${notif?.jumlahSiswa ?? 0} siswa ${notif?.nama ?? ''} yang diabsen hari ini. Lanjutkan melengkapi absensi?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => terimaNotif(false)}>
              Nanti Saja
            </Button>
            <Button onClick={() => terimaNotif(true)}>
              <ClipboardCheck className="h-4 w-4" /> Absen Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
