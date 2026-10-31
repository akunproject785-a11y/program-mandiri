'use client'

/**
 * Section Ringkasan: kartu statistik, setoran terbaru, dan distribusi per program.
 * API /api/summary sudah men-scope data otomatis untuk musyrif.
 * - Admin: statistik global (siswa, musyrif, halaqoh, program, setoran).
 * - Musyrif: HANYA data yang berhubungan dengannya (siswa binaan, halaqoh binaan,
 *   program yang diampu, setoran binaan) + daftar halaqoh binaan.
 * Catatan: Type (tipe form) TIDAK ditampilkan di sini — Program sudah mewakilinya;
 * tipe hanya menentukan jenis form input setoran.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  Camera,
  ClipboardList,
  FolderOpen,
  IdCard,
  Inbox,
  Network,
  Users,
} from 'lucide-react'
import { api } from '@/lib/client'
import { describeSetoran, formatTanggalIndo } from '@/lib/format'
import { type SummaryData, type UserInfo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  EmptyState,
  LoadingBlock,
  StatCard,
} from '@/components/dashboard/ui-helpers'

export default function RingkasanSection({
  user,
  onNavigate,
}: {
  user: UserInfo
  /** Dipakai CTA musyrif untuk melompat ke menu Absen. */
  onNavigate?: (section: 'absensi') => void
}) {
  const isMusyrif = user.role === 'musyrif'
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    api<{ summary: SummaryData }>('/api/summary')
      .then((data) => {
        if (mounted) setSummary(data.summary)
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [refreshKey])

  const retry = useCallback(() => {
    setError(null)
    setLoading(true)
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <>
      {/* Greeting */}
      <div>
        <p className="text-lg font-semibold tracking-tight">Assalamu&apos;alaikum, {user.name}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {isMusyrif
            ? 'Berikut ringkasan aktivitas tahfidz halaqoh binaan Anda.'
            : 'Berikut ringkasan aktivitas tahfidz hari ini.'}
        </p>
      </div>

      {/* CTA Absen (khusus musyrif) — menggantikan CTA Input Setoran */}
      {isMusyrif && onNavigate ? (
        <Card className="mt-4 gap-0 border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Sudah absen hari ini?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ambil foto selfie sebagai bukti kehadiran, lalu tunggu verifikasi admin.
              </p>
            </div>
            <Button
              onClick={() => onNavigate('absensi')}
              className="min-h-11 w-fit shrink-0 sm:min-h-9"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Absen
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <LoadingBlock label="Memuat ringkasan…" />
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Gagal memuat ringkasan"
          description={error}
        >
          <Button onClick={retry}>Coba Lagi</Button>
        </EmptyState>
      ) : summary ? (
        <>
          {/* Kartu statistik */}
          {isMusyrif ? (
            /* Musyrif: hanya statistik yang berhubungan dengan dirinya */
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mt-6">
              <StatCard
                label="Siswa Binaan"
                value={summary.totalSiswa}
                icon={<Users className="text-primary" />}
              />
              <StatCard
                label="Halaqoh Binaan"
                value={summary.totalHalaqoh}
                icon={<Network className="text-primary" />}
              />
              <StatCard
                label="Program Diampu"
                value={summary.programDiampu ?? 0}
                icon={<FolderOpen className="text-primary" />}
              />
              <StatCard
                label="Setoran Bulan Ini"
                value={summary.setoranBulanIni}
                icon={<CalendarCheck className="text-primary" />}
              />
              <StatCard
                label="Total Setoran"
                value={summary.totalSetoran}
                icon={<ClipboardList className="text-primary" />}
              />
            </div>
          ) : (
            /* Admin: statistik global lembaga */
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mt-6">
              <StatCard
                label="Siswa Aktif"
                value={summary.totalSiswa}
                icon={<Users className="text-primary" />}
              />
              <StatCard
                label="Total Musyrif"
                value={summary.totalMusyrif}
                icon={<IdCard className="text-primary" />}
              />
              <StatCard
                label="Halaqoh"
                value={summary.totalHalaqoh}
                icon={<Network className="text-primary" />}
              />
              <StatCard
                label="Program Kelas"
                value={summary.totalProgram}
                icon={<FolderOpen className="text-primary" />}
              />
              <StatCard
                label="Setoran Bulan Ini"
                value={summary.setoranBulanIni}
                icon={<CalendarCheck className="text-primary" />}
              />
              <StatCard
                label="Total Setoran"
                value={summary.totalSetoran}
                icon={<ClipboardList className="text-primary" />}
              />
            </div>
          )}

          {/* Halaqoh binaan musyrif */}
          {isMusyrif ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Halaqoh Binaan Saya</CardTitle>
                <CardDescription>
                  Daftar halaqoh yang Anda bina beserta program kelasnya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(summary.halaqohSaya ?? []).length === 0 ? (
                  <EmptyState
                    icon={<Network />}
                    title="Belum ada halaqoh binaan"
                    description="Anda belum ditugaskan sebagai pembina halaqoh. Hubungi admin."
                  />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {(summary.halaqohSaya ?? []).map((h) => (
                      <li key={h.id} className="rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{h.nama}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {h.kode} • {h.programNama}
                          </p>
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          {h.jumlahSiswa} siswa
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Dua kolom: setoran terbaru + distribusi per program */}
          <div className="grid gap-6 mt-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Setoran Terbaru</CardTitle>
                <CardDescription>
                  {isMusyrif
                    ? 'Aktivitas setoran terakhir pada halaqoh binaan Anda.'
                    : 'Aktivitas setoran terakhir yang tercatat.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary.recentSetoran.length === 0 ? (
                  <EmptyState
                    icon={<Inbox />}
                    title="Belum ada setoran"
                    description={
                      isMusyrif
                        ? 'Setoran binaan Anda akan tampil di sini. Mulai lewat menu Input Setoran.'
                        : 'Setoran yang dicatat musyrif akan tampil di sini.'
                    }
                  />
                ) : (
                  <ul className="max-h-96 overflow-y-auto [scrollbar-width:thin]">
                    {summary.recentSetoran.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 py-3 border-b last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{item.siswaNama}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {describeSetoran(item)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTanggalIndo(item.tanggal)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Setoran per Program</CardTitle>
                <CardDescription>
                  {isMusyrif
                    ? 'Distribusi setoran binaan Anda per program kelas.'
                    : 'Distribusi setoran per program kelas.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary.perProgram.length === 0 ? (
                  <EmptyState
                    icon={<FolderOpen />}
                    title="Belum ada setoran"
                    description="Distribusi setoran per program akan tampil di sini."
                  />
                ) : (
                  <div className="space-y-4">
                    {summary.perProgram.map((p) => {
                      const total = summary.totalSetoran
                      const percent = total > 0 ? Math.round((p.jumlah / total) * 100) : 0
                      return (
                        <div key={p.id}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium" title={p.nama}>
                              {p.nama}
                            </span>
                            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                              {p.jumlah} setoran
                            </span>
                          </div>
                          <Progress
                            value={percent}
                            className="mt-2"
                            aria-label={`Persentase setoran program ${p.nama}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </>
  )
}
