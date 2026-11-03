'use client'

/**
 * Form input setoran dinamis (Type A / B / C / D) untuk SATU siswa tertentu.
 * Dipakai bersama oleh:
 *  - SetoranFormDialog (menu Data Rekapan, admin & musyrif) — mode BUAT (POST)
 *  - InputSetoranSection (alur Program → Halaqoh → Siswa di dashboard musyrif) — BUAT
 *  - SetoranEditDialog (edit setoran yang sudah ada) — mode EDIT (PUT /api/setoran/:id)
 *
 * Kontrak:
 *  - Mode buat: wajib `siswa`; parent wajib memberikan `key={siswa.id}` agar
 *    seluruh state form termount ulang (bersih) setiap kali siswa berganti.
 *  - Mode edit: wajib `initial` (data setoran yang diedit); field identitas
 *    (siswa/tipe/program) tidak bisa diubah — hanya isi data setoran.
 *  - `onSuccess` dipanggil setelah setoran berhasil disimpan (toast sudah
 *    ditampilkan di sini). `onCancel` opsional — tombol Batal hanya muncul
 *    bila disediakan.
 *  - `wajibAbsen` (mode BUAT musyrif): siswa wajib punya absensi pada tanggal
 *    setoran sebelum tombol simpan aktif; absen cepat tersedia di dalam form.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import {
  formatTanggalIndo,
  hariFromTanggal,
  todayISO,
} from '@/lib/format'
import { getSurahsByJuz, JUZ_OPTIONS_C_D } from '@/lib/quran-data'
import {
  MENU_SETORAN_C,
  MENU_SETORAN_D,
  NILAI_OPTIONS,
  STATUS_KEHADIRAN,
  type SetoranItem,
  type SiswaItem,
  type StatusKehadiran,
  type TipeInputan,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/dashboard/ui-helpers'

/** Opsi juz untuk tipe B: 1 sampai 30. */
const JUZ_OPTIONS_B: number[] = Array.from({ length: 30 }, (_, i) => i + 1)

interface FormState {
  tanggal: string
  // Type A
  anaba: string
  halaman: string
  jumlahBaris: string
  nilaiKelancaran: string
  kualitasBacaan: string
  catatanMusyrif: string
  // Type B
  juzB: string
  suratB: string
  ayatB: string
  materiBelajar: string
  nilai: string
  // Type C & D
  juzCD: string
  menuSetoran: string
  suratCD: string
  ayatCD: string
  halamanMushaf: string
  jumlahBarisCD: string
  nilaiKelancaranCD: string
  kualitasBacaanCD: string
  catatanMusyrifCD: string
}

function createInitialForm(): FormState {
  return {
    tanggal: todayISO(),
    anaba: '',
    halaman: '',
    jumlahBaris: '',
    nilaiKelancaran: '',
    kualitasBacaan: '',
    catatanMusyrif: '',
    juzB: '',
    suratB: '',
    ayatB: '',
    materiBelajar: '',
    nilai: '',
    juzCD: '',
    menuSetoran: '',
    suratCD: '',
    ayatCD: '',
    halamanMushaf: '',
    jumlahBarisCD: '',
    nilaiKelancaranCD: '',
    kualitasBacaanCD: '',
    catatanMusyrifCD: '',
  }
}

/** String opsional: kosong → undefined (field tidak dikirim). */
function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Angka opsional: kosong/invalid → undefined. */
function optionalInt(value: string): number | undefined {
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Prefill form dari data setoran yang sudah ada (mode EDIT). */
function createFormFromSetoran(item: SetoranItem): FormState {
  return {
    tanggal: item.tanggal || todayISO(),
    anaba: item.anaba ?? '',
    halaman: item.halaman ?? '',
    jumlahBaris: item.jumlahBaris != null ? String(item.jumlahBaris) : '',
    nilaiKelancaran: item.nilaiKelancaran ?? '',
    kualitasBacaan: item.kualitasBacaan ?? '',
    catatanMusyrif: item.catatanMusyrif ?? '',
    juzB: item.juz != null ? String(item.juz) : '',
    suratB: item.surat ?? '',
    ayatB: item.ayat ?? '',
    materiBelajar: item.materiBelajar ?? '',
    nilai: item.nilai ?? '',
    juzCD: item.juz != null ? String(item.juz) : '',
    menuSetoran: item.menuSetoran ?? '',
    suratCD: item.surat ?? '',
    ayatCD: item.ayat ?? '',
    halamanMushaf: item.halamanMushaf ?? '',
    jumlahBarisCD: item.jumlahBaris != null ? String(item.jumlahBaris) : '',
    nilaiKelancaranCD: item.nilaiKelancaran ?? '',
    kualitasBacaanCD: item.kualitasBacaan ?? '',
    catatanMusyrifCD: item.catatanMusyrif ?? '',
  }
}

/** Body POST /api/setoran — hanya field sesuai tipe yang diisi. */
interface SetoranBody {
  siswaId: string
  tipe: TipeInputan
  tanggal: string
  anaba?: string
  halaman?: string
  jumlahBaris?: number
  nilaiKelancaran?: string
  kualitasBacaan?: string
  catatanMusyrif?: string
  juz?: number
  surat?: string
  ayat?: string
  materiBelajar?: string
  nilai?: string
  menuSetoran?: string
  halamanMushaf?: string
}

export default function SetoranFormFields({
  siswa,
  initial,
  onSuccess,
  onCancel,
  submitLabel,
  wajibAbsen = false,
}: {
  /** Siswa target (mode BUAT). */
  siswa?: SiswaItem
  /** Data setoran yang diedit (mode EDIT). */
  initial?: SetoranItem
  onSuccess: () => void
  onCancel?: () => void
  submitLabel?: string
  /** Mode BUAT musyrif: siswa wajib diabsen pada tanggal setoran sebelum simpan. */
  wajibAbsen?: boolean
}) {
  const isEdit = Boolean(initial)
  const tipe: TipeInputan = initial?.tipe ?? siswa?.tipeInputan ?? 'A'
  const siswaId = siswa?.id
  const halaqohId = siswa?.halaqohId ?? null
  const [form, setForm] = useState<FormState>(() =>
    initial ? createFormFromSetoran(initial) : createInitialForm()
  )
  const [submitting, setSubmitting] = useState(false)

  // ===== Gate absen (mode BUAT musyrif): siswa harus diabsen dulu =====
  // absenStatus: undefined = sedang dicek, null = belum diabsen, objek = sudah.
  const perluCekAbsen = Boolean(!isEdit && wajibAbsen && siswaId && halaqohId && form.tanggal)
  const [absenStatus, setAbsenStatus] = useState<
    { status: StatusKehadiran; keterangan: string | null } | null | undefined
  >(undefined)
  const [absenCekError, setAbsenCekError] = useState<string | null>(null)
  const [absenSaving, setAbsenSaving] = useState<StatusKehadiran | null>(null)
  const [absenCekKey, setAbsenCekKey] = useState(0)

  useEffect(() => {
    if (!perluCekAbsen || !halaqohId || !siswaId) return
    let mounted = true
    setAbsenStatus(undefined)
    setAbsenCekError(null)
    api<{ siswa: Array<{ id: string; absen: { status: StatusKehadiran; keterangan: string | null } | null }> }>(
      `/api/absensi-siswa?halaqohId=${encodeURIComponent(halaqohId)}&tanggal=${encodeURIComponent(form.tanggal)}`
    )
      .then((d) => {
        if (!mounted) return
        setAbsenStatus(d.siswa.find((s) => s.id === siswaId)?.absen ?? null)
      })
      .catch(() => {
        if (mounted) setAbsenCekError('Gagal memeriksa status absen.')
      })
    return () => {
      mounted = false
    }
  }, [perluCekAbsen, halaqohId, siswaId, form.tanggal, absenCekKey])

  const absenCepat = async (status: StatusKehadiran) => {
    if (!halaqohId || !siswaId || !form.tanggal) return
    setAbsenSaving(status)
    try {
      await api('/api/absensi-siswa', {
        method: 'POST',
        body: {
          halaqohId,
          tanggal: form.tanggal,
          entries: [{ siswaId, status }],
        },
      })
      toast.success(`${siswa?.nama ?? 'Siswa'} diabsen: ${status}`)
      setAbsenCekKey((k) => k + 1)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal mengabsen siswa. Silakan coba lagi.'
      )
    } finally {
      setAbsenSaving(null)
    }
  }

  // Simpan diblokir selama status absen belum diketahui pasti ada
  // (belum diabsen, atau masih memeriksa). Gagal cek = fail-open agar tidak mengunci.
  const absenGate =
    perluCekAbsen && !absenCekError && (absenStatus === undefined || absenStatus === null)

  // Daftar surat mengikuti juz yang dipilih (tipe B dan C/D).
  const surahsB = useMemo(
    () => (form.juzB ? getSurahsByJuz(parseInt(form.juzB, 10)) : []),
    [form.juzB]
  )
  const surahsCD = useMemo(
    () => (form.juzCD ? getSurahsByJuz(parseInt(form.juzCD, 10)) : []),
    [form.juzCD]
  )

  const hari = hariFromTanggal(form.tanggal) || '—'

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isEdit && !siswaId) {
      toast.error('Siswa wajib dipilih terlebih dahulu.')
      return
    }
    if (!form.tanggal) {
      toast.error('Tanggal setoran wajib diisi.')
      return
    }
    if (absenGate) {
      toast.error(
        'Siswa belum diabsen. Absen siswa terlebih dahulu sebelum mencatat setoran.'
      )
      return
    }

    let body: SetoranBody

    if (tipe === 'A') {
      if (!form.nilaiKelancaran) {
        toast.error('Pilih nilai kelancaran terlebih dahulu.')
        return
      }
      if (!form.kualitasBacaan) {
        toast.error('Pilih kualitas bacaan terlebih dahulu.')
        return
      }
      body = {
        siswaId: siswaId ?? '',
        tipe,
        tanggal: form.tanggal,
        anaba: optionalText(form.anaba),
        halaman: optionalText(form.halaman),
        jumlahBaris: optionalInt(form.jumlahBaris),
        nilaiKelancaran: form.nilaiKelancaran,
        kualitasBacaan: form.kualitasBacaan,
        catatanMusyrif: optionalText(form.catatanMusyrif),
      }
    } else if (tipe === 'B') {
      if (!form.juzB) {
        toast.error('Pilih opsi juz terlebih dahulu.')
        return
      }
      if (!form.suratB) {
        toast.error('Pilih surat terlebih dahulu.')
        return
      }
      if (!form.materiBelajar.trim()) {
        toast.error('Materi belajar wajib diisi.')
        return
      }
      if (!form.nilai) {
        toast.error('Pilih nilai terlebih dahulu.')
        return
      }
      body = {
        siswaId: siswaId ?? '',
        tipe,
        tanggal: form.tanggal,
        juz: optionalInt(form.juzB),
        surat: form.suratB,
        ayat: optionalText(form.ayatB),
        materiBelajar: form.materiBelajar.trim(),
        nilai: form.nilai,
      }
    } else {
      if (!form.juzCD) {
        toast.error('Pilih juz terlebih dahulu.')
        return
      }
      if (!form.menuSetoran) {
        toast.error('Pilih menu setoran terlebih dahulu.')
        return
      }
      if (!form.suratCD) {
        toast.error('Pilih surat terlebih dahulu.')
        return
      }
      if (!form.nilaiKelancaranCD) {
        toast.error('Pilih nilai kelancaran terlebih dahulu.')
        return
      }
      if (!form.kualitasBacaanCD) {
        toast.error('Pilih kualitas bacaan terlebih dahulu.')
        return
      }
      body = {
        siswaId: siswaId ?? '',
        tipe,
        tanggal: form.tanggal,
        juz: optionalInt(form.juzCD),
        menuSetoran: form.menuSetoran,
        surat: form.suratCD,
        ayat: optionalText(form.ayatCD),
        halamanMushaf: optionalText(form.halamanMushaf),
        jumlahBaris: optionalInt(form.jumlahBarisCD),
        nilaiKelancaran: form.nilaiKelancaranCD,
        kualitasBacaan: form.kualitasBacaanCD,
        catatanMusyrif: optionalText(form.catatanMusyrifCD),
      }
    }

    setSubmitting(true)
    try {
      if (isEdit && initial) {
        await api(`/api/setoran/${initial.id}`, { method: 'PUT', body })
        toast.success('Perubahan setoran berhasil disimpan')
      } else {
        await api('/api/setoran', { method: 'POST', body })
        toast.success('Setoran berhasil dicatat')
      }
      onSuccess()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Hari & tanggal (hari di-derive otomatis) */}
      <Field label="Hari & Tanggal" required htmlFor="setoran-tanggal">
        <div className="space-y-2">
          <Badge variant="secondary" className="font-normal" aria-live="polite">
            Hari: {hari}
          </Badge>
          <Input
            id="setoran-tanggal"
            type="date"
            required
            value={form.tanggal}
            onChange={(e) => setField('tanggal', e.target.value)}
            disabled={submitting}
            className="min-h-11"
          />
        </div>
      </Field>

      {/* ===== Gate absen — musyrif wajib mengabsen siswa dulu (mode BUAT) ===== */}
      {perluCekAbsen ? (
        <div
          aria-live="polite"
          className="rounded-md border p-3 text-sm"
          role="status"
        >
          {absenCekError ? (
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">{absenCekError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9"
                onClick={() => setAbsenCekKey((k) => k + 1)}
              >
                Coba Lagi
              </Button>
            </div>
          ) : absenStatus === undefined ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Memeriksa absen siswa…
            </p>
          ) : absenStatus === null ? (
            <div className="space-y-2.5">
              <p className="flex items-start gap-2 font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Siswa belum diabsen pada {hari.toLowerCase()}, {formatTanggalIndo(form.tanggal)}.
                  Absen siswa terlebih dahulu sebelum mencatat setoran.
                </span>
              </p>
              <div className="flex flex-wrap gap-2" aria-label="Absen cepat">
                {STATUS_KEHADIRAN.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={s === 'HADIR' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-10"
                    disabled={absenSaving !== null || submitting}
                    onClick={() => absenCepat(s)}
                  >
                    {absenSaving === s ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    {s}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tersimpan sebagai absen hari {hari.toLowerCase()}, {formatTanggalIndo(form.tanggal)} — keterangan dapat dilengkapi di menu Absen.
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                Sudah diabsen: {absenStatus.status}
                {absenStatus.keterangan ? ` — ${absenStatus.keterangan}` : ''}
              </span>
            </p>
          )}
        </div>
      ) : null}

      {/* ===== Type A — Tahsin Anaba ===== */}
      {tipe === 'A' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Materi Anaba" htmlFor="setoran-anaba">
              <Input
                id="setoran-anaba"
                placeholder="cth: Bab 3"
                value={form.anaba}
                onChange={(e) => setField('anaba', e.target.value)}
                disabled={submitting}
                className="min-h-11"
              />
            </Field>
            <Field label="Halaman" htmlFor="setoran-halaman">
              <Input
                id="setoran-halaman"
                placeholder="cth: 12"
                value={form.halaman}
                onChange={(e) => setField('halaman', e.target.value)}
                disabled={submitting}
                className="min-h-11"
              />
            </Field>
          </div>
          <Field label="Jumlah Baris" htmlFor="setoran-baris-a">
            <Input
              id="setoran-baris-a"
              type="number"
              min={1}
              placeholder="cth: 5"
              value={form.jumlahBaris}
              onChange={(e) => setField('jumlahBaris', e.target.value)}
              disabled={submitting}
              className="min-h-11"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nilai Kelancaran" required>
              <Select
                value={form.nilaiKelancaran}
                onValueChange={(v) => setField('nilaiKelancaran', v)}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Nilai kelancaran" className="w-full min-h-11">
                  <SelectValue placeholder="Pilih nilai…" />
                </SelectTrigger>
                <SelectContent>
                  {NILAI_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Kualitas Bacaan" required>
              <Select
                value={form.kualitasBacaan}
                onValueChange={(v) => setField('kualitasBacaan', v)}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Kualitas bacaan" className="w-full min-h-11">
                  <SelectValue placeholder="Pilih nilai…" />
                </SelectTrigger>
                <SelectContent>
                  {NILAI_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Catatan Musyrif" htmlFor="setoran-catatan-a">
            <Textarea
              id="setoran-catatan-a"
              rows={2}
              placeholder="Catatan tambahan (opsional)"
              value={form.catatanMusyrif}
              onChange={(e) => setField('catatanMusyrif', e.target.value)}
              disabled={submitting}
            />
          </Field>
        </>
      ) : null}

      {/* ===== Type B — Materi Belajar ===== */}
      {tipe === 'B' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opsi Juz" required>
              <Select
                value={form.juzB}
                onValueChange={(v) => setForm((prev) => ({ ...prev, juzB: v, suratB: '' }))}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Opsi juz" className="w-full min-h-11">
                  <SelectValue placeholder="Pilih juz…" />
                </SelectTrigger>
                <SelectContent>
                  {JUZ_OPTIONS_B.map((j) => (
                    <SelectItem key={j} value={String(j)}>
                      Juz {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pilihan Surat" required>
              <Select
                value={form.suratB}
                onValueChange={(v) => setField('suratB', v)}
                disabled={submitting || surahsB.length === 0}
              >
                <SelectTrigger aria-label="Pilihan surat" className="w-full min-h-11">
                  <SelectValue placeholder={form.juzB ? 'Pilih surat…' : 'Pilih juz dulu'} />
                </SelectTrigger>
                <SelectContent>
                  {surahsB.map((s) => (
                    <SelectItem key={s.nomor} value={s.nama}>
                      {s.nomor}. {s.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ayat" htmlFor="setoran-ayat-b">
              <Input
                id="setoran-ayat-b"
                placeholder="cth: 1-10"
                value={form.ayatB}
                onChange={(e) => setField('ayatB', e.target.value)}
                disabled={submitting}
                className="min-h-11"
              />
            </Field>
            <Field label="Materi Belajar" required htmlFor="setoran-materi-b">
              <Input
                id="setoran-materi-b"
                placeholder="cth: Hukum nun sukun"
                value={form.materiBelajar}
                onChange={(e) => setField('materiBelajar', e.target.value)}
                disabled={submitting}
                className="min-h-11"
              />
            </Field>
          </div>
          <Field label="Nilai" required>
            <Select
              value={form.nilai}
              onValueChange={(v) => setField('nilai', v)}
              disabled={submitting}
            >
              <SelectTrigger aria-label="Nilai" className="w-full min-h-11">
                <SelectValue placeholder="Pilih nilai…" />
              </SelectTrigger>
              <SelectContent>
                {NILAI_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      ) : null}

      {/* ===== Type C & D — Tahfidz Juz 30 / Murojaah Juz ===== */}
      {tipe === 'C' || tipe === 'D' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pilihan Juz" required>
              <Select
                value={form.juzCD}
                onValueChange={(v) => setForm((prev) => ({ ...prev, juzCD: v, suratCD: '' }))}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Pilihan juz" className="w-full min-h-11">
                  <SelectValue placeholder="Pilih juz…" />
                </SelectTrigger>
                <SelectContent>
                  {JUZ_OPTIONS_C_D.map((j) => (
                    <SelectItem key={j} value={String(j)}>
                      Juz {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Menu Setoran" required>
              <Select
                value={form.menuSetoran}
                onValueChange={(v) => setField('menuSetoran', v)}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Menu setoran" className="w-full min-h-11">
                  <SelectValue placeholder="Pilih menu…" />
                </SelectTrigger>
                <SelectContent>
                  {(tipe === 'C' ? MENU_SETORAN_C : MENU_SETORAN_D).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Pilihan Surat" required>
            <Select
              value={form.suratCD}
              onValueChange={(v) => setField('suratCD', v)}
              disabled={submitting || surahsCD.length === 0}
            >
              <SelectTrigger aria-label="Pilihan surat" className="w-full min-h-11">
                <SelectValue placeholder={form.juzCD ? 'Pilih surat…' : 'Pilih juz dulu'} />
              </SelectTrigger>
              <SelectContent>
                {surahsCD.map((s) => (
                  <SelectItem key={s.nomor} value={s.nama}>
                    {s.nomor}. {s.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ayat" htmlFor="setoran-ayat-cd">
              <Input
                id="setoran-ayat-cd"
                placeholder="cth: 1-20"
                value={form.ayatCD}
                onChange={(e) => setField('ayatCD', e.target.value)}
                disabled={submitting}
                className="min-h-11"
              />
            </Field>
            <Field label="Halaman Mushaf" htmlFor="setoran-halaman-mushaf">
              <Input
                id="setoran-halaman-mushaf"
                placeholder="cth: 582"
                value={form.halamanMushaf}
                onChange={(e) => setField('halamanMushaf', e.target.value)}
                disabled={submitting}
                className="min-h-11"
              />
            </Field>
          </div>
          <Field label="Jumlah Baris" htmlFor="setoran-baris-cd">
            <Input
              id="setoran-baris-cd"
              type="number"
              min={1}
              placeholder="cth: 5"
              value={form.jumlahBarisCD}
              onChange={(e) => setField('jumlahBarisCD', e.target.value)}
              disabled={submitting}
              className="min-h-11"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nilai Kelancaran" required>
              <Select
                value={form.nilaiKelancaranCD}
                onValueChange={(v) => setField('nilaiKelancaranCD', v)}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Nilai kelancaran" className="w-full min-h-11">
                  <SelectValue placeholder="Pilih nilai…" />
                </SelectTrigger>
                <SelectContent>
                  {NILAI_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Kualitas Bacaan" required>
              <Select
                value={form.kualitasBacaanCD}
                onValueChange={(v) => setField('kualitasBacaanCD', v)}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Kualitas bacaan" className="w-full min-h-11">
                  <SelectValue placeholder="Pilih nilai…" />
                </SelectTrigger>
                <SelectContent>
                  {NILAI_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Catatan Musyrif" htmlFor="setoran-catatan-cd">
            <Textarea
              id="setoran-catatan-cd"
              rows={2}
              placeholder="Catatan tambahan (opsional)"
              value={form.catatanMusyrifCD}
              onChange={(e) => setField('catatanMusyrifCD', e.target.value)}
              disabled={submitting}
            />
          </Field>
        </>
      ) : null}

      {/* Aksi */}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-11 sm:min-h-9"
          >
            Batal
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={submitting || absenGate}
          title={absenGate ? 'Absen siswa terlebih dahulu' : undefined}
          className="min-h-11 sm:min-h-9"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {absenGate ? 'Absen Siswa Dulu' : submitLabel ?? (isEdit ? 'Simpan Perubahan' : 'Simpan Setoran')}
        </Button>
      </div>
    </form>
  )
}
