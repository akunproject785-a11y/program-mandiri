# Program Qur'an Mandiri

Website pencatatan Tahfidz/Halaqoh: kelola program kelas, halaqoh, musyrif, siswa, dan rekap setoran hafalan dalam satu dashboard. Dibangun dengan **Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma**, terintegrasi penuh dengan **Supabase**:

- **Database** — PostgreSQL (Prisma, koneksi via Supavisor pooler)
- **Auth** — Supabase Auth email + password (role `admin` & `musyrif` dari tabel profil)
- **Realtime** — sinkronisasi otomatis data setoran di dashboard (Postgres Changes)
- **Storage** — unggah foto siswa (bucket public `foto-siswa`)

## Fitur

- Landing page + login (admin / musyrif)
- Dashboard admin: Ringkasan, Program Kelas (4 tipe form input), Data Musyrif, Data Halaqoh, Data Siswa (dengan unggah foto), Rekap Setoran (filter + cetak PDF + ekspor WA)
- Dashboard musyrif: input setoran sesuai tipe program, ringkasan ter-scope halaqoh
- Import massal data siswa (template Excel, upload file, copy-paste)
- Reset password & ganti password via Supabase Auth
- Responsif mobile-first, tema emerald, UI Bahasa Indonesia

## Menjalankan Lokal

```bash
bun install          # atau npm install
cp .env.example .env # lalu isi kredensial Supabase Anda
bun run dev          # buka http://localhost:3000
```

> Skema database dikelola dengan `prisma db push`. Untuk project Supabase baru:
> ```bash
> npx prisma db push     # butuh DIRECT_URL
> ```

## Deploy ke Vercel + Supabase

### 1. Siapkan Supabase

1. Buat project di [supabase.com](https://supabase.com)
2. **Project Settings → Database** — catat password database
3. Jalankan skema: dari komputer lokal, set `.env` (isi `DATABASE_URL` pooler port 6543 dan `DIRECT_URL` port 5432) lalu:
   ```bash
   npm install
   npx prisma db push
   ```
4. **Authentication → Providers → Email**: aktifkan Email provider (konfirmasi email bisa dimatikan untuk penggunaan internal)
5. Buat akun admin pertama lewat **Authentication → Users → Add user**, lalu tambahkan baris profil di **Table Editor → Admin** (`authUserId` = id user auth, `email` sama)
6. **Storage**: buat bucket public bernama `foto-siswa`
7. **Database → Publications**: pastikan tabel `Setoran` ada di publication (untuk Realtime)
8. Setelah URL Vercel diketahui, tambahkan ke **Authentication → URL Configuration → Site URL / Redirect URLs**

### 2. Deploy ke Vercel

1. Push repo ini ke GitHub
2. Di [vercel.com](https://vercel.com) → **Add New → Project → Import** repo GitHub Anda
3. Framework terdeteksi otomatis (Next.js). Tidak perlu mengubah Build Command
4. Tambahkan **Environment Variables** berikut (Production + Preview):

   | Variabel | Nilai |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key dari Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key dari Supabase |
   | `DATABASE_URL` | pooler port **6543** + `?pgbouncer=true&connection_limit=10` |
   | `DIRECT_URL` | pooler port **5432** (atau host langsung `db.<ref>.supabase.co:5432`) |

5. **Deploy** — `postinstall` otomatis menjalankan `prisma generate`
6. Setelah deploy selesai, salin domain Vercel (mis. `https://nama-app.vercel.app`) dan tambahkan sebagai **Site URL** di Supabase Auth agar login/logout berfungsi

### Catatan keamanan

- `.env` tidak pernah di-commit (lihat `.gitignore`); semua rahasia cukup diisi di Vercel Environment Variables
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di Route Handlers server (admin auth, storage), tidak pernah dikirim ke browser
- Row Level Security (RLS) aktif di Supabase; operasi tulis sensitif melewati API server dengan verifikasi role
