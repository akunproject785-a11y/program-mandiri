'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  BookOpenText,
  CircleCheck,
  ClipboardCheck,
  LayoutTemplate,
  LineChart,
  LogIn,
  Moon,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/client'
import type { SettingsData, StatsData, UserInfo } from '@/lib/types'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LoginDialog } from '@/components/landing/login-dialog'

const DEFAULT_SETTINGS: SettingsData = {
  heroBadge: "Tahfidz Al-Qur'an",
  heroTitle: "Program Qur'an Mandiri",
  heroSubtitle:
    "Membangun Generasi Penghafal Al-Qur'an yang Mandiri, Berilmu, dan Berakhlak Mulia",
  heroDescription:
    'Platform pencatatan setoran tahfidz yang terpadu — kelola program kelas, halaqoh, musyrif, dan data siswa dalam satu dashboard yang mudah digunakan.',
  aboutTitle: 'Tentang Program',
  aboutText:
    "Program Qur'an Mandiri hadir sebagai pembinaan hafalan Al-Qur'an yang terstruktur. Setiap santri dibimbing mencapai target hafalan melalui setoran rutin yang terdokumentasi dan penilaian yang objektif, sehingga perkembangan hafalan dapat dipantau secara menyeluruh oleh institusi maupun wali santri.",
}

interface FeatureItem {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: ClipboardCheck,
    title: 'Pencatatan Setoran Harian',
    description: 'Musyrif mencatat setoran tiap santri lengkap dengan hari, tanggal, dan penilaian.',
  },
  {
    icon: LayoutTemplate,
    title: '4 Tipe Form Fleksibel',
    description: 'Form input otomatis menyesuaikan tipe program kelas (Type A, B, C, dan D).',
  },
  {
    icon: Users,
    title: 'Manajemen Halaqoh',
    description: 'Kelola data musyrif, halaqoh, dan siswa dalam satu dashboard terpusat.',
  },
  {
    icon: LineChart,
    title: 'Rekapan & Monitoring',
    description: 'Pantau perkembangan hafalan melalui data rekapan yang rapi dan real-time.',
  },
]

const ABOUT_POINTS: string[] = [
  'Target hafalan terukur per program kelas',
  'Penilaian kelancaran & kualitas bacaan terdokumentasi',
  'Laporan berkala untuk wali santri',
]

/** Warnai kata "Mandiri" pada judul hero dengan aksen emerald muda (jika ada). */
function renderHeroTitle(title: string): ReactNode {
  const marker = 'Mandiri'
  const idx = title.indexOf(marker)
  if (idx === -1) return title
  return (
    <>
      {title.slice(0, idx)}
      <span className="text-emerald-300">{marker}</span>
      {title.slice(idx + marker.length)}
    </>
  )
}

function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary p-2 shadow-sm ${className ?? ''}`}
    >
      <BookOpenText className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
    </div>
  )
}

function SiteHeader({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <LogoMark className="h-9 w-9 sm:h-10 sm:w-10" />
          <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
            <span className="min-[380px]:hidden">Program Qur&apos;an</span>
            <span className="hidden min-[380px]:inline">Program Qur&apos;an Mandiri</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle className="size-11" />
          <Button onClick={onLoginClick} className="h-11 px-3 sm:px-4">
            <LogIn className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            Masuk
          </Button>
        </div>
      </div>
    </header>
  )
}

interface HeroSectionProps {
  settings: SettingsData
  stats: StatsData | null
  onLoginClick: () => void
}

function HeroSection({ settings, stats, onLoginClick }: HeroSectionProps) {
  const scrollToFitur = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('fitur')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const statItems: { label: string; value: number | null | undefined }[] = [
    { label: 'Siswa Aktif', value: stats?.siswa },
    { label: 'Halaqoh', value: stats?.halaqoh },
    { label: 'Musyrif', value: stats?.musyrif },
    { label: 'Setoran Tercatat', value: stats?.setoran },
  ]

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: 'url(/images/hero-pattern.png)' }}
      />
      <Sparkles
        aria-hidden="true"
        className="absolute right-[8%] top-10 h-16 w-16 text-emerald-200/10 sm:h-24 sm:w-24"
      />
      <Star
        aria-hidden="true"
        className="absolute left-[5%] top-24 h-12 w-12 text-emerald-200/10 sm:h-20 sm:w-20"
      />
      <Moon
        aria-hidden="true"
        className="absolute right-[26%] top-12 hidden h-10 w-10 text-emerald-200/10 lg:block"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:py-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-emerald-200">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {settings.heroBadge}
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {renderHeroTitle(settings.heroTitle)}
        </h1>

        <p className="mt-4 max-w-2xl text-lg font-medium text-emerald-100/90 sm:text-xl">
          {settings.heroSubtitle}
        </p>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-emerald-100/70 sm:text-base">
          {settings.heroDescription}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            onClick={onLoginClick}
            className="h-12 min-h-11 bg-white px-6 text-base font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Masuk ke Dashboard
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <a
            href="#fitur"
            onClick={scrollToFitur}
            className="inline-flex h-12 min-h-11 items-center justify-center gap-2 rounded-md border border-white/30 px-6 text-base font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Pelajari Program
          </a>
        </div>

        <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-4 backdrop-blur-md"
            >
              <p className="text-2xl font-bold text-white sm:text-3xl">
                {typeof item.value === 'number' ? item.value.toLocaleString('id-ID') : '-'}
              </p>
              <p className="mt-1 text-xs text-emerald-100/70 sm:text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="fitur" className="scroll-mt-20 bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Fitur Unggulan
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Semua Kebutuhan Pencatatan Tahfidz
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="gap-4 rounded-2xl p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutSection({ settings }: { settings: SettingsData }) {
  return (
    <section className="bg-secondary/40 py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2 lg:gap-14">
        <img
          src="/images/hero-quran.png"
          alt="Arsitektur masjid bernuansa hijau zamrud, simbol ketenangan dalam menuntut ilmu Al-Qur'an"
          loading="lazy"
          className="aspect-[4/3] w-full rounded-3xl object-cover shadow-xl"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Tentang Kami
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {settings.aboutTitle}
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{settings.aboutText}</p>
          <ul className="mt-6 space-y-3">
            {ABOUT_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm sm:text-base">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto bg-emerald-950 text-emerald-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <LogoMark />
            <div>
              <p className="text-sm font-semibold text-white">Program Qur&apos;an Mandiri</p>
              <p className="mt-0.5 text-xs text-emerald-200/80">
                Mencetak generasi Qur&apos;ani yang mandiri
              </p>
            </div>
          </div>
          <p className="text-xs text-emerald-200/70">
            © {year} Program Qur&apos;an Mandiri
          </p>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage({
  onLoginSuccess,
}: {
  onLoginSuccess: (user: UserInfo) => void
}) {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const [settingsRes, statsRes] = await Promise.allSettled([
        api<{ settings: SettingsData }>('/api/settings'),
        api<{ stats: StatsData }>('/api/stats'),
      ])
      if (!mounted) return
      if (settingsRes.status === 'fulfilled') {
        setSettings({ ...DEFAULT_SETTINGS, ...settingsRes.value.settings })
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.stats)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const openLogin = () => setLoginOpen(true)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader onLoginClick={openLogin} />
      <main className="flex-1">
        <HeroSection settings={settings} stats={stats} onLoginClick={openLogin} />
        <FeaturesSection />
        <AboutSection settings={settings} />
      </main>
      <SiteFooter />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLoginSuccess={onLoginSuccess} />
    </div>
  )
}
