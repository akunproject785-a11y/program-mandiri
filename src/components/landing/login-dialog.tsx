'use client'

import { useState, type FormEvent } from 'react'
import { BookOpenText, Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type { UserInfo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess: (user: UserInfo) => void
}

export function LoginDialog({ open, onOpenChange, onLoginSuccess }: LoginDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      const data = await api<{ user: UserInfo }>('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      })
      toast.success(`Selamat datang, ${data.user.name}`)
      onLoginSuccess(data.user)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login gagal. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-sm">
        <Card className="rounded-lg border-0 shadow-none">
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary p-2.5 shadow-sm">
                <BookOpenText className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  Selamat Datang Kembali
                </DialogTitle>
                <DialogDescription>Masuk sebagai Admin atau Musyrif</DialogDescription>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Email</Label>
                <Input
                  id="login-username"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Masukkan email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="min-h-11 w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Memproses…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Masuk
                  </>
                )}
              </Button>
            </form>

            <p className="rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Demo — Admin:{' '}
              <code className="font-mono font-semibold text-foreground">admin@quranmandiri.id</code>{' '}
              / <code className="font-mono font-semibold text-foreground">admin123</code> · Musyrif:{' '}
              <code className="font-mono font-semibold text-foreground">amanda@quranmandiri.id</code>{' '}
              / <code className="font-mono font-semibold text-foreground">musyrif123</code>
            </p>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
