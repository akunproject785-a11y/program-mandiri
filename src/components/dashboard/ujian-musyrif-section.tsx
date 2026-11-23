'use client'

/**
 * Section Ujian (musyrif) — wizard dua tahap:
 * 1. Tujuan Pembelajaran (TP): musyrif wajib menyimpan MINIMAL 2 TP sebelum
 *    bisa mencatat ujian siswa. TP tersimpan dapat ditambah; TP yang sudah
 *    dipakai pada nilai ujian tidak dapat dihapus.
 * 2. Catat ujian siswa: muncul setelah syarat TP terpenuhi — pilih siswa +
 *    input NILAI PER TP (berdasarkan TP yang diinput musyrif); nilai ujian
 *    disimpan sebagai rata-rata nilai per TP.
 * Menu ini hanya aktif bila admin mengaktifkannya (Setting 'ujian_musyrif_aktif').
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  FileCheck,
  ListChecks,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { formatTanggalIndo, hariFromTanggal } from '@/lib/format'
import type { UjianItem, UjianMusyrifData, UjianSiswaOpsi } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog, EmptyState, LoadingBlock, SectionHeader } from '@/components/dashboard/ui-helpers'

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

/** Tanggal hari ini zona WIB (default form). */
function hariIniWib(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Target gabungan untuk dialog konfirmasi hapus (ujian atau TP). */
type HapusTarget = { jenis: 'ujian'; data: UjianItem } | { jenis: 'tp'; id: string; teks: string }

export default function UjianMusyrifSection() {
  const [data, setData] = useState<UjianMusyrifData | null>(null)
  const [loading, setLoading] = useState(true)

  const [refreshKey, setRefreshKey] = useState(0)
  const muat = useCallback(() => setRefreshKey((k) => k + 1), [])

  // ---- Tahap 1: TP ----
  const [tpBaru, setTpBaru] = useState<string[]>([''])
  const [tpLoading, setTpLoading] = useState(false)

  // ---- Tahap 2: ujian siswa (muncul bila tp.length >= 2) ----
  const [siswaId, setSiswaId] = useState('')
  const [tanggal, setTanggal] = useState(hariIniWib())
  const [jenis, setJenis] = useState('')
  const [bab, setBab] = useState('')
  const [nilaiTp, setNilaiTp] = useState<Record<string, string>>({})
  const [catatan, setCatatan] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const [bukaId, setBukaId] = useState<string | null>(null)
  const [hapusTarget, setHapusTarget] = useState<HapusTarget | null>(null)
  const [hapusLoading, setHapusLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api<UjianMusyrifData>('/api/ujian/musyrif')
      .then((d) => {
        if (mounted) setData(d)
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
  }, [refreshKey])

  const tpTersimpan = data?.tp ?? []
  const gateTerbuka = tpTersimpan.length >= 2

  const siswaTerpilih: UjianSiswaOpsi | undefined = useMemo(
    () => data?.siswa.find((s) => s.id === siswaId),
    [data, siswaId]
  )

  // ---- Aksi TP ----
  const simpanTp = async () => {
    const teks = tpBaru.map((t) => t.trim()).filter((t) => t.length > 0)
    if (teks.length === 0) {
      toast.error('Isi minimal satu deskripsi TP')
      return
    }
    setTpLoading(true)
    try {
      const { tp } = await api<{ tp: UjianMusyrifData['tp'] }>('/api/ujian/tp', {
        method: 'POST',
        body: { teks },
      })
      setData((prev) => (prev ? { ...prev, tp } : prev))
      setTpBaru([''])
      toast.success(`${teks.length} TP tersimpan`, {
        description:
          tp.length >= 2
            ? 'Form input ujian siswa kini terbuka.'
            : 'Tambah minimal 2 TP agar form ujian siswa terbuka.',
      })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setTpLoading(false)
    }
  }

  const submitHapus = async () => {
    if (!hapusTarget) return
    setHapusLoading(true)
    try {
      if (hapusTarget.jenis === 'ujian') {
        await api(`/api/ujian/musyrif/${hapusTarget.data.id}`, { method: 'DELETE' })
        setData((prev) =>
          prev ? { ...prev, items: prev.items.filter((i) => i.id !== hapusTarget.data.id) } : prev
        )
        toast.success('Record ujian dihapus')
      } else {
        await api(`/api/ujian/tp/${hapusTarget.id}`, { method: 'DELETE' })
        setData((prev) =>
          prev ? { ...prev, tp: prev.tp.filter((t) => t.id !== hapusTarget.id) } : prev
        )
        toast.success('TP dihapus')
      }
      setHapusTarget(null)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setHapusLoading(false)
      setHapusTarget(null)
    }
  }

  // ---- Aksi ujian siswa ----
  const submit = async () => {
    if (!gateTerbuka) return
    if (!siswaId) {
      toast.error('Pilih siswa terlebih dahulu')
      return
    }
    if (!jenis.trim()) {
      toast.error('Jenis ujian wajib diisi')
      return
    }
    const nilaiKirim = tpTersimpan.map((t) => ({ tpId: t.id, nilai: Number(nilaiTp[t.id]) }))
    if (nilaiKirim.some((n) => !Number.isInteger(n.nilai) || n.nilai < 0 || n.nilai > 100)) {
      toast.error('Semua nilai TP wajib diisi (angka bulat 0–100)')
      return
    }
    setSubmitLoading(true)
    try {
      const { ujian } = await api<{ ujian: UjianItem }>('/api/ujian/musyrif', {
        method: 'POST',
        body: { siswaId, tanggal, jenis: jenis.trim(), bab: bab.trim() || undefined, nilaiTp: nilaiKirim, catatan: catatan.trim() || undefined },
      })
      setData((prev) => (prev ? { ...prev, items: [ujian, ...prev.items] } : prev))
      toast.success(`Ujian ${ujian.siswaNama} tercatat`, { description: `${ujian.jenis} — nilai rata-rata ${ujian.nilai}` })
      setJenis('')
      setBab('')
      setNilaiTp({})
      setCatatan('')
      setSiswaId('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Ujian" description="Catat hasil ujian hafalan siswa halaqoh binaan." />
        {loading ? <LoadingBlock label="Memuat ujian…" /> : null}
      </div>
    )
  }

  if (!data.aktif) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Ujian" description="Catat hasil ujian hafalan siswa halaqoh binaan." />
        <EmptyState
          icon={<BookOpenCheck />}
          title="Menu Ujian dinonaktifkan"
          description="Fitur ujian sedang dinonaktifkan oleh admin. Hubungi admin bila Anda membutuhkan menu ini."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ujian"
        description="Tahap 1: input Tujuan Pembelajaran (minimal 2). Tahap 2: catat ujian siswa dengan nilai per TP."
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      {/* ---- Tahap 1: Tujuan Pembelajaran ---- */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-medium">
              <ListChecks className="h-4 w-4" /> Tujuan Pembelajaran (TP)
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                gateTerbuka
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {tpTersimpan.length}/2 TP tersimpan
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Wajib menyimpan minimal 2 TP sebelum dapat menginput ujian per siswa. Nilai ujian
            dihitung berdasarkan TP-TP ini.
          </p>

          {tpTersimpan.length > 0 ? (
            <ol className="space-y-1.5">
              {tpTersimpan.map((t, idx) => (
                <li key={t.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/60 px-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="mr-2 font-semibold tabular-nums text-muted-foreground">TP{idx + 1}</span>
                    {t.teks}
                  </span>
                  {!t.dipakai ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setHapusTarget({ jenis: 'tp', id: t.id, teks: t.teks })}
                      aria-label={`Hapus TP ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="shrink-0 self-center text-[10px] text-muted-foreground">terpakai</span>
                  )}
                </li>
              ))}
            </ol>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tambah TP baru</p>
            {tpBaru.map((v, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Deskripsi TP ${tpTersimpan.length + i + 1} — mis. "Siswa lancar membaca juz 30"`}
                  value={v}
                  maxLength={200}
                  onChange={(e) =>
                    setTpBaru((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                  }
                  aria-label={`Deskripsi TP baru ${i + 1}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  disabled={tpBaru.length === 1}
                  onClick={() => setTpBaru((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Hapus baris TP ${i + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTpBaru((prev) => [...prev, ''])}
              >
                <Plus className="h-4 w-4" /> Tambah baris
              </Button>
              <Button size="sm" onClick={simpanTp} disabled={tpLoading}>
                {tpLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                Simpan TP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Tahap 2: catat ujian siswa (terkunci sebelum 2 TP tersimpan) ---- */}
      {!gateTerbuka ? (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Input ujian siswa terkunci</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Simpan minimal 2 Tujuan Pembelajaran (TP) di atas. Setelah tersimpan, pilihan
                siswa dan input nilai per TP akan muncul di sini.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <p className="flex items-center gap-2 font-medium">
              <Plus className="h-4 w-4" /> Catat Ujian Siswa
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Siswa {data.siswa.length === 0 ? '(halaqoh binaan kosong)' : ''}
                </p>
                <Select value={siswaId} onValueChange={setSiswaId}>
                  <SelectTrigger className="w-full" aria-label="Pilih siswa">
                    <SelectValue placeholder={data.siswa.length === 0 ? 'Tidak ada siswa' : 'Pilih siswa'} />
                  </SelectTrigger>
                  <SelectContent>
                    {data.siswa.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nama} {s.halaqohNama ? `— ${s.halaqohNama}` : ''} ({s.kelas})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Tanggal ujian</p>
                <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Jenis ujian</p>
                <Input
                  placeholder="mis. Pelajaran, Mutqin, Ziyadah"
                  value={jenis}
                  maxLength={100}
                  onChange={(e) => setJenis(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Bab / hafalan (opsional)</p>
                <Input
                  placeholder="mis. Juz 30 — An-Naba' 1–20"
                  value={bab}
                  maxLength={200}
                  onChange={(e) => setBab(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Nilai per Tujuan Pembelajaran (0–100)</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tpTersimpan.map((t, idx) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                      <span className="min-w-0 flex-1 truncate text-xs" title={t.teks}>
                        <span className="mr-1.5 font-semibold text-muted-foreground">TP{idx + 1}</span>
                        {t.teks}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="0–100"
                        className="w-24 shrink-0"
                        value={nilaiTp[t.id] ?? ''}
                        onChange={(e) => setNilaiTp((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        aria-label={`Nilai TP ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Catatan (opsional)</p>
                <Textarea
                  placeholder="mis. Lancar, perbaiki mad thabi'i pada ayat 3"
                  value={catatan}
                  maxLength={300}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {siswaTerpilih
                  ? `Nilai rata-rata TP untuk ${siswaTerpilih.nama}`
                  : 'Nilai ujian = rata-rata nilai per TP.'}
              </p>
              <Button onClick={submit} disabled={submitLoading || data.siswa.length === 0}>
                {submitLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Simpan Ujian
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Daftar ujian ---- */}
      {data.items.length === 0 ? (
        <EmptyState
          icon={<FileCheck />}
          title="Belum ada ujian"
          description={
            gateTerbuka
              ? 'Belum ada hasil ujian yang Anda catat. Gunakan form di atas untuk mencatat ujian pertama.'
              : 'Belum ada hasil ujian. Simpan minimal 2 TP terlebih dahulu, lalu catat ujian pertama Anda.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              {/* tabel desktop — klik baris untuk melihat nilai per TP */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Siswa</th>
                    <th className="px-4 py-3 font-medium">Jenis</th>
                    <th className="px-4 py-3 font-medium">Bab</th>
                    <th className="px-4 py-3 text-center font-medium">Nilai</th>
                    <th className="px-4 py-3 font-medium">Catatan</th>
                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <Fragment key={u.id}>
                      <tr
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                        onClick={() => setBukaId((cur) => (cur === u.id ? null : u.id))}
                      >
                        <td className="whitespace-nowrap px-4 py-3">{formatTanggalIndo(u.tanggal)}</td>
                        <td className="max-w-40 truncate px-4 py-3 font-medium">{u.siswaNama}</td>
                        <td className="px-4 py-3">{u.jenis}</td>
                        <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{u.bab ?? '—'}</td>
                        <td className="px-4 py-3 text-center"><NilaiUjianBadge nilai={u.nilai} /></td>
                        <td className="max-w-52 truncate px-4 py-3 text-muted-foreground">{u.catatan ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHapusTarget({ jenis: 'ujian', data: u })
                            }}
                            aria-label={`Hapus ujian ${u.siswaNama}`}
                          >
                            <Trash2 className="h-4 w-4" /> Hapus
                          </Button>
                        </td>
                      </tr>
                      {bukaId === u.id ? (
                        <tr className="border-b bg-muted/30 last:border-0">
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="flex flex-wrap gap-x-4 gap-y-1">
                                {(u.nilaiTp ?? []).map((n, idx) => (
                                  <span key={n.tpId}>
                                    <span className="font-semibold">TP{idx + 1}</span> {n.teks}:{' '}
                                    <span className="font-semibold tabular-nums">{n.nilai}</span>
                                  </span>
                                ))}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* kartu mobile — breakdown per TP selalu tampil */}
            <div className="grid gap-3 p-4 md:hidden">
              {data.items.map((u, idx) => (
                <div key={u.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{u.siswaNama}</p>
                      <p className="text-xs text-muted-foreground">
                        {hariFromTanggal(u.tanggal)}, {formatTanggalIndo(u.tanggal)} • {u.jenis}
                      </p>
                      {u.bab ? <p className="mt-0.5 text-xs">Bab: {u.bab}</p> : null}
                      <div className="mt-1.5 space-y-1">
                        {(u.nilaiTp ?? []).map((n, tIdx) => (
                          <p key={n.tpId} className="truncate text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">TP{tIdx + 1}</span>{' '}
                            <ChevronRight className="inline h-3 w-3" /> {n.teks} —{' '}
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setHapusTarget({ jenis: 'ujian', data: u })}
                    aria-label={`Hapus ujian ${u.siswaNama} baris ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" /> Hapus
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(hapusTarget)}
        onOpenChange={(open) => !open && !hapusLoading && setHapusTarget(null)}
        title={hapusTarget?.jenis === 'tp' ? 'Hapus TP?' : 'Hapus Ujian?'}
        description={
          hapusTarget?.jenis === 'tp'
            ? `Hapus TP "${hapusTarget.teks}"? TP yang belum dipakai pada nilai ujian saja yang dapat dihapus.`
            : hapusTarget
              ? `Hapus ujian ${hapusTarget.data.siswaNama} (${hapusTarget.data.jenis}, ${formatTanggalIndo(hapusTarget.data.tanggal)})? Data akan hilang dari rekapan admin.`
              : ''
        }
        confirmText="Hapus"
        onConfirm={submitHapus}
        loading={hapusLoading}
      />
    </div>
  )
}
