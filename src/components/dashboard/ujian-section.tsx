'use client'

/**
 * Section Ujian (admin):
 * 1. Kartu aktivasi — toggle yang menentukan tampil/sembunyinya menu Ujian
 *    pada dashboard musyrif (Setting 'ujian_musyrif_aktif').
 * 2. Rekapan ujian per musyrif — total ujian, siswa diujikan, rata-rata nilai,
 *    ujian terakhir; rentang tanggal opsional; tombol Detail membuka daftar
 *    lengkap ujian musyrif terpilih.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, CalendarRange, FileCheck, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { formatTanggalIndo } from '@/lib/format'
import type { UjianAdminData, UjianItem, UjianRekapMusyrif } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, LoadingBlock, SectionHeader } from '@/components/dashboard/ui-helpers'

/** Warna nilai: < 60 merah, 60–79 amber, >= 80 hijau. */
function NilaiUjianBadge({ nilai }: { nilai: number }) {
  const cls =
    nilai >= 80
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : nilai >= 60
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {nilai}
    </span>
  )
}

export default function UjianSection() {
  const [aktif, setAktif] = useState<boolean | null>(null)
  const [ta, setTa] = useState('')
  const [taInput, setTaInput] = useState('')
  const [taLoading, setTaLoading] = useState(false)
  const [rekap, setRekap] = useState<UjianRekapMusyrif[]>([])
  const [loading, setLoading] = useState(true)

  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Detail dialog
  const [detailTarget, setDetailTarget] = useState<UjianRekapMusyrif | null>(null)
  const [detail, setDetail] = useState<UjianItem[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const muat = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const params = new URLSearchParams()
    if (dari) params.set('dari', dari)
    if (sampai) params.set('sampai', sampai)
    const qs = params.toString()
    api<UjianAdminData>(`/api/ujian/admin${qs ? `?${qs}` : ''}`)
      .then((data) => {
        if (!mounted) return
        setAktif(data.aktif)
        setTa(data.tahunAjaran)
        setTaInput((cur) => cur || data.tahunAjaran)
        setRekap(data.rekap)
      })
      .catch((err: Error) => {
        if (mounted) toast.error(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [dari, sampai, refreshKey])

  const toggleAktif = async (nilai: boolean) => {
    if (nilai && !ta) {
      // Wajib isi tahun ajaran dulu — tanpa itu tidak ada data yang dipakai.
      toast.error('Isi tahun ajaran terlebih dahulu sebelum mengaktifkan Ujian')
      return
    }
    const sebelum = aktif
    setAktif(nilai) // optimistis
    try {
      await api('/api/setting-ujian', { method: 'PATCH', body: { aktif: nilai } })
      toast.success(
        nilai ? 'Menu Ujian musyrif diaktifkan' : 'Menu Ujian musyrif dinonaktifkan',
        {
          description: nilai
            ? `Musyrif kini mencatat ujian untuk tahun ajaran ${ta}.`
            : 'Menu Ujian disembunyikan dari dashboard musyrif.',
        }
      )
    } catch (err) {
      setAktif(sebelum) // kembalikan bila gagal
      toast.error((err as Error).message)
    }
  }

  const simpanTa = async () => {
    const taBaru = taInput.trim()
    if (!taBaru) {
      toast.error('Tahun ajaran tidak boleh kosong')
      return
    }
    setTaLoading(true)
    try {
      const res = await api<{ aktif: boolean; tahunAjaran: string }>('/api/setting-ujian', {
        method: 'PATCH',
        body: { tahunAjaran: taBaru },
      })
      setTa(res.tahunAjaran)
      toast.success(`Tahun ajaran ${res.tahunAjaran} tersimpan`, {
        description:
          'Data yang digunakan kini milik tahun ajaran ini — musyrif menginput ulang TP & ujian baru; data tahun ajaran sebelumnya tetap tersimpan sebagai arsip.',
      })
      muat()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setTaLoading(false)
    }
  }

  const bukaDetail = async (r: UjianRekapMusyrif) => {
    setDetailTarget(r)
    setDetail(null)
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({ musyrifId: r.musyrifId })
      if (dari) params.set('dari', dari)
      if (sampai) params.set('sampai', sampai)
      const data = await api<UjianAdminData>(`/api/ujian/admin?${params.toString()}`)
      setDetail(data.detail ?? [])
    } catch (err) {
      toast.error((err as Error).message)
      setDetailTarget(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const statistik = useMemo(() => {
    const total = rekap.reduce((s, r) => s + r.total, 0)
    const siswaUnik = rekap.reduce((s, r) => s + r.siswaDiujikan, 0)
    const berbobot = rekap.filter((r) => r.rataNilai !== null)
    const rata =
      berbobot.length > 0
        ? Math.round(
            (berbobot.reduce((s, r) => s + (r.rataNilai as number) * r.total, 0) / total) * 10
          ) / 10
        : null
    return { total, siswaUnik, rata }
  }, [rekap])

  const adaFilter = dari !== '' || sampai !== ''

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ujian"
        description={
          ta
            ? `Aktifkan menu Ujian untuk musyrif dan pantau rekapan ujian tahun ajaran ${ta} dari masing-masing musyrif.`
            : 'Isi tahun ajaran terlebih dahulu, lalu aktifkan menu Ujian untuk musyrif.'
        }
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      {/* Tahun ajaran (prasyarat aktivasi) + aktivasi menu Ujian musyrif */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">Aktifkan Menu Ujian pada Dashboard Musyrif</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Saat aktif, musyrif melihat menu Ujian untuk mencatat hasil ujian hafalan siswa.
                Saat nonaktif, menu disembunyikan dan pencatatan baru ditolak.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <Switch
                checked={aktif === true}
                disabled={aktif === null}
                onCheckedChange={toggleAktif}
                aria-label="Aktifkan menu Ujian musyrif"
              />
              <span className="text-xs font-medium text-muted-foreground">
                {aktif === null ? '…' : aktif ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarRange className="h-4 w-4" /> Tahun Ajaran
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  ta
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {ta ? `Aktif: ${ta}` : 'Belum diatur'}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Wajib diisi sebelum mengaktifkan Ujian. Mengganti tahun ajaran memindahkan data yang
              digunakan: musyrif menginput TP &amp; ujian baru untuk tahun ajaran tersebut, dan data
              tahun ajaran sebelumnya tetap tersimpan sebagai arsip.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder='mis. "2026/2027"'
                value={taInput}
                maxLength={30}
                onChange={(e) => setTaInput(e.target.value)}
                aria-label="Tahun ajaran ujian"
                className="sm:w-44"
              />
              <Button size="sm" onClick={simpanTa} disabled={taLoading || !taInput.trim()}>
                {taLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                Simpan Tahun Ajaran
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Ujian (filter ini)', value: statistik.total, cls: '' },
          { label: 'Total Siswa Diujikan', value: statistik.siswaUnik, cls: '' },
          {
            label: 'Rata-rata Nilai',
            value: statistik.rata === null ? '—' : statistik.rata,
            cls: 'text-emerald-700 dark:text-emerald-400',
          },
        ].map((s) => (
          <Card key={s.label} className="gap-0 p-4">
            <p className={`text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filter rentang tanggal */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:w-44">
            <p className="text-xs font-medium text-muted-foreground">Dari tanggal</p>
            <Input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
              aria-label="Filter ujian dari tanggal"
            />
          </div>
          <div className="space-y-1.5 sm:w-44">
            <p className="text-xs font-medium text-muted-foreground">Sampai tanggal</p>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
              aria-label="Filter ujian sampai tanggal"
            />
          </div>
          {adaFilter ? (
            <Button
              variant="ghost"
              onClick={() => {
                setDari('')
                setSampai('')
              }}
              className="sm:ml-auto"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
              <CalendarRange className="h-3.5 w-3.5" /> Kosongkan untuk melihat semua
            </p>
          )}
        </CardContent>
      </Card>

      {/* Rekapan per musyrif */}
      {loading ? (
        <LoadingBlock label="Memuat rekapan ujian…" />
      ) : rekap.length === 0 ? (
        <EmptyState
          icon={<BookOpenCheck />}
          title="Belum ada data musyrif"
          description="Tambahkan musyrif terlebih dahulu di menu Data Musyrif."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Musyrif</TableHead>
                    <TableHead className="text-center">Total Ujian</TableHead>
                    <TableHead className="text-center">Siswa Diujikan</TableHead>
                    <TableHead className="text-center">Rata-rata Nilai</TableHead>
                    <TableHead>Ujian Terakhir</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekap.map((r) => (
                    <TableRow key={r.musyrifId}>
                      <TableCell className="font-medium">{r.musyrifNama}</TableCell>
                      <TableCell className="text-center tabular-nums">{r.total}</TableCell>
                      <TableCell className="text-center tabular-nums">{r.siswaDiujikan}</TableCell>
                      <TableCell className="text-center">
                        {r.rataNilai === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <NilaiUjianBadge nilai={r.rataNilai} />
                        )}
                      </TableCell>
                      <TableCell>
                        {r.terakhir ? formatTanggalIndo(r.terakhir) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => bukaDetail(r)}
                          disabled={r.total === 0}
                          aria-label={`Detail ujian ${r.musyrifNama}`}
                        >
                          <FileCheck className="h-4 w-4" /> Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Kartu mobile */}
            <div className="grid gap-3 p-4 md:hidden">
              {rekap.map((r) => (
                <div key={r.musyrifId} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{r.musyrifNama}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-muted px-1 py-1.5">
                      <p className="text-base font-bold tabular-nums">{r.total}</p>
                      <p className="text-[10px] text-muted-foreground">Ujian</p>
                    </div>
                    <div className="rounded bg-muted px-1 py-1.5">
                      <p className="text-base font-bold tabular-nums">{r.siswaDiujikan}</p>
                      <p className="text-[10px] text-muted-foreground">Siswa</p>
                    </div>
                    <div className="rounded bg-muted px-1 py-1.5">
                      <p className="text-base font-bold tabular-nums">
                        {r.rataNilai === null ? '—' : r.rataNilai}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Rata-rata</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {r.terakhir ? `Terakhir: ${formatTanggalIndo(r.terakhir)}` : 'Belum mengujikan'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bukaDetail(r)}
                      disabled={r.total === 0}
                    >
                      <FileCheck className="h-4 w-4" /> Detail
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog detail ujian satu musyrif */}
      <Dialog open={Boolean(detailTarget)} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Ujian — {detailTarget?.musyrifNama}</DialogTitle>
            <DialogDescription>
              {adaFilter
                ? `Rentang: ${dari ? formatTanggalIndo(dari) : '…'} — ${sampai ? formatTanggalIndo(sampai) : '…'}`
                : 'Seluruh ujian yang dicatat musyrif ini.'}
              {ta ? ` Tahun Ajaran ${ta}.` : ''}
            </DialogDescription>
          </DialogHeader>
          {detailLoading || detail === null ? (
            <LoadingBlock label="Memuat detail…" />
          ) : detail.length === 0 ? (
            <EmptyState icon={<FileCheck />} title="Tidak ada ujian" description="Belum ada ujian pada rentang ini." />
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {detail.map((u) => (
                <div key={u.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{u.siswaNama}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTanggalIndo(u.tanggal)} • {u.jenis}
                        {u.halaqohNama ? ` • ${u.halaqohNama}` : ''}
                      </p>
                      {u.bab ? <p className="mt-0.5 text-xs">Bab: {u.bab}</p> : null}
                      <div className="mt-1.5 space-y-0.5">
                        {(u.nilaiTp ?? []).map((n, idx) => (
                          <p key={n.tpId} className="truncate text-xs text-muted-foreground" title={n.teks}>
                            <span className="font-semibold text-foreground">TP{idx + 1}</span> {n.teks} —{' '}
                            <span className="font-semibold tabular-nums text-foreground">{n.nilai}</span>
                          </p>
                        ))}
                      </div>
                      {u.catatan ? (
                        <p className="mt-1 rounded bg-muted px-1.5 py-0.5 text-xs">{u.catatan}</p>
                      ) : null}
                    </div>
                    <NilaiUjianBadge nilai={u.nilai} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetailTarget(null)}>
              <X className="h-4 w-4" /> Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
