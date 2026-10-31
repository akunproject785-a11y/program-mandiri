'use client'

/**
 * Section Pengaturan:
 * - Admin: (1) tampilan halaman depan (PUT /api/settings), (2) ganti password admin
 *   (POST /api/auth/change-password).
 * - Musyrif: ganti password musyrif sendiri (endpoint yang sama).
 */
import { useEffect, useState } from 'react'
import { Info, KeyRound, LayoutDashboard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type { SettingsData, UserInfo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, SectionHeader } from '@/components/dashboard/ui-helpers'

const EMPTY_SETTINGS: SettingsData = {
  heroBadge: '',
  heroTitle: '',
  heroSubtitle: '',
  heroDescription: '',
  aboutTitle: '',
  aboutText: '',
}

function TampilanCard() {
  const [form, setForm] = useState<SettingsData>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    api<{ settings: SettingsData }>('/api/settings')
      .then((data) => {
        if (mounted) setForm(data.settings)
      })
      .catch((err: Error) => {
        if (mounted) setLoadError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const setField = (key: keyof SettingsData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api<{ settings: SettingsData }>('/api/settings', { method: 'PUT', body: form })
      toast.success('Tampilan halaman depan diperbarui')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary p-2 text-secondary-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>Tampilan Halaman Depan</CardTitle>
            <CardDescription>
              Atur teks hero dan section tentang pada landing page.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Memuat pengaturan…
          </p>
        ) : loadError ? (
          <p className="py-4 text-sm text-destructive">{loadError}</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
          >
            <Field label="Label kecil di atas judul hero" htmlFor="heroBadge">
              <Input
                id="heroBadge"
                value={form.heroBadge}
                onChange={(e) => setField('heroBadge', e.target.value)}
                placeholder="Program Tahfidz Terstruktur"
              />
            </Field>
            <Field label="Judul Utama Hero" htmlFor="heroTitle" required>
              <Input
                id="heroTitle"
                value={form.heroTitle}
                onChange={(e) => setField('heroTitle', e.target.value)}
                required
              />
            </Field>
            <Field label="Subjudul" htmlFor="heroSubtitle">
              <Input
                id="heroSubtitle"
                value={form.heroSubtitle}
                onChange={(e) => setField('heroSubtitle', e.target.value)}
              />
            </Field>
            <Field label="Deskripsi Program" htmlFor="heroDescription">
              <Textarea
                id="heroDescription"
                rows={3}
                value={form.heroDescription}
                onChange={(e) => setField('heroDescription', e.target.value)}
              />
            </Field>
            <Field label="Judul Section Tentang" htmlFor="aboutTitle">
              <Input
                id="aboutTitle"
                value={form.aboutTitle}
                onChange={(e) => setField('aboutTitle', e.target.value)}
              />
            </Field>
            <Field label="Teks Section Tentang" htmlFor="aboutText">
              <Textarea
                id="aboutText"
                rows={5}
                value={form.aboutText}
                onChange={(e) => setField('aboutText', e.target.value)}
              />
            </Field>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Perubahan akan tampil di halaman depan saat pengunjung membuka website.
              </p>
              <Button type="submit" disabled={saving} className="min-h-11 sm:min-h-9">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan Perubahan
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function PasswordCard({ user }: { user: UserInfo }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak sama dengan password baru.')
      return
    }
    setSaving(true)
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      })
      toast.success('Password berhasil diubah')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary p-2 text-secondary-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>
              {user.role === 'admin' ? 'Ganti Password Admin' : 'Ganti Password Musyrif'}
            </CardTitle>
            <CardDescription>
              Perbarui password untuk akun {user.name}. Gunakan password yang kuat.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Password Saat Ini" htmlFor="currentPassword" required>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Password Baru"
            htmlFor="newPassword"
            required
            hint="Minimal 6 karakter."
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Konfirmasi Password Baru" htmlFor="confirmPassword" required>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </Field>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="pt-1">
            <Button type="submit" disabled={saving} className="min-h-11 sm:min-h-9">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Ganti Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function SettingsSection({ user }: { user: UserInfo }) {
  const isAdmin = user.role === 'admin'
  return (
    <>
      <SectionHeader
        title="Pengaturan"
        description={
          isAdmin
            ? 'Ubah tampilan halaman depan dan keamanan akun admin.'
            : 'Ubah keamanan akun musyrif Anda.'
        }
      />
      <div className="grid gap-6 mt-6 max-w-3xl">
        {isAdmin ? <TampilanCard /> : null}
        <PasswordCard user={user} />
      </div>
    </>
  )
}
