'use client'

/**
 * Section Ujian (musyrif): catat hasil ujian hafalan siswa halaqoh binaan.
 * - Menu ini hanya aktif bila admin mengaktifkannya (Setting 'ujian_musyrif_aktif').
 * - Form input: siswa, tanggal, jenis, bab, nilai (0–100), catatan.
 * - Daftar ujian yang pernah dicatat + hapus milik sendiri.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, FileCheck, Plus, RotateCcw, Trash2 } from 'lucide-react'
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

export default function UjianMusyrifSection() {
  const [data, setData] = useState<UjianMusyrifData | null>(null)
  const [loading, setLoading] = useState(true)

  const [refreshKey, setRefreshKey] = useState(0)
  const muat = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Form
  const [siswaId, setSiswaId] = useState('')
  const [tanggal, setTanggal] = useState(hariIniWib())
  const [jenis, setJenis] = useState('')
  const [bab, setBab] = useState('')
  const [nilai, setNilai] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const [hapusTarget, setHapusTarget] = useState<UjianItem | null>(null)
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

  const siswaTerpilih: UjianSiswaOpsi | undefined = useMemo(
    () => data?.siswa.find((s) => s.id === siswaId),
    [data, siswaId]
  )

  const submit = async () => {
    if (!siswaId) {
      toast.error('Pilih siswa terlebih dahulu')
      return
    }
    const nilaiNum = Number(nilai)
    if (!jenis.trim()) {
      toast.error('Jenis ujian wajib diisi')
      return
    }
    if (!Number.isInteger(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      toast.error('Nilai harus angka bulat 0–100')
      return
    }
    setSubmitLoading(true)
    try {
      const { ujian } = await api<{ ujian: UjianItem }>('/api/ujian/musyrif', {
        method: 'POST',
        body: { siswaId, tanggal, jenis: jenis.trim(), bab: bab.trim() || undefined, nilai: nilaiNum, catatan: catatan.trim() || undefined },
      })
      setData((prev) => (prev ? { ...prev, items: [ujian, ...prev.items] } : prev))
      toast.success(`Ujian ${ujian.siswaNama} tercatat`, { description: `${ujian.jenis} — nilai ${ujian.nilai}` })
      setJenis('')
      setBab('')
      setNilai('')
      setCatatan('')
      setSiswaId('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitLoading(false)
    }
  }

  const submitHapus = async () => {
    if (!hapusTarget) return
    setHapusLoading(true)
    try {
      await api(`/api/ujian/musyrif/${hapusTarget.id}`, { method: 'DELETE' })
      setData((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== hapusTarget.id) } : prev
      )
      toast.success('Record ujian dihapus')
      setHapusTarget(null)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setHapusLoading(false)
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
        description="Catat hasil ujian hafalan siswa halaqoh binaan. Rekapan otomatis tampil di dashboard admin."
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      {/* Form input ujian */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Plus className="h-4 w-4" /> Catat Ujian Baru
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
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Nilai (0–100)</p>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="mis. 85"
                value={nilai}
                onChange={(e) => setNilai(e.target.value)}
                aria-label="Nilai ujian"
              />
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
              {siswaTerpilih ? `Ujian untuk ${siswaTerpilih.nama}` : 'Semua ujian terekap di dashboard admin.'}
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

      {/* Daftar ujian */}
      {data.items.length === 0 ? (
        <EmptyState
          icon={<FileCheck />}
          title="Belum ada ujian"
          description="Belum ada hasil ujian yang Anda catat. Gunakan form di atas untuk mencatat ujian pertama."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              {/* tabel desktop */}
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
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatTanggalIndo(u.tanggal)}
                      </td>
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
                          onClick={() => setHapusTarget(u)}
                          aria-label={`Hapus ujian ${u.siswaNama}`}
                        >
                          <Trash2 className="h-4 w-4" /> Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* kartu mobile */}
            <div className="grid gap-3 p-4 md:hidden">
              {data.items.map((u) => (
                <div key={u.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{u.siswaNama}</p>
                      <p className="text-xs text-muted-foreground">
                        {hariFromTanggal(u.tanggal)}, {formatTanggalIndo(u.tanggal)} • {u.jenis}
                      </p>
                      {u.bab ? <p className="mt-0.5 text-xs">Bab: {u.bab}</p> : null}
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
                    onClick={() => setHapusTarget(u)}
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
        title="Hapus Ujian?"
        description={
          hapusTarget
            ? `Hapus ujian ${hapusTarget.siswaNama} (${hapusTarget.jenis}, ${formatTanggalIndo(hapusTarget.tanggal)})? Data akan hilang dari rekapan admin.`
            : ''
        }
        confirmText="Hapus"
        onConfirm={submitHapus}
        loading={hapusLoading}
      />
    </div>
  )
}
