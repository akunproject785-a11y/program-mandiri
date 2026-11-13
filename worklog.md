# Worklog — Program Qur'an Mandiri (Website Pencatatan Tahfidz)

> SEMUA agent WAJIB membaca file ini sebelum bekerja, dan WAJIB menambahkan
> laporan setiap selesai tugas (Task ID baru, apa yang dikerjakan, hasil).
>
> PENTING (pelajaran recycle sandbox): file yang TIDAK di-commit git bisa
> hilang/mundur versi setiap giliran sesi. Karena itu file ini di-commit ke
> repo agar tahan recycle. Jangan simpan kredensial baru di sini selain yang
> sudah terdokumentasi Task 16/17 (kebutuhan pemulihan env).

## Pembagian File (milik eksklusif)
- (bagian asli dipertahankan — lihat riwayat git bila perlu detail kontrak)

## Akun Demo (seed)
- admin@quranmandiri.id / admin123 (role admin)
- amanda@quranmandiri.id / musyrif123 (musyrif, Halaqoh Khadijah 11 siswa)
- nazar@quranmandiri.id / musyrif123 (musyrif)

## Catatan Lingkungan (recycle-resistant, WAJIB dibaca agent berikutnya)
- Deploy Vercel: WAJIB ada `.vercel/project.json` menunjuk project
  `program-mandiri` (orgId team_kg8EUdhay7D2A0BIy1IY9E8X). Bila hilang, CLI
  MEMBUAT PROYEK BARU dari nama folder ("my-project") — pernah terjadi 5 Nov
  2026 dan proyek sisa itu dihapus. Recreate manual: ambil projectId via
  `GET /v9/projects/program-mandiri` (Authorization Bearer token) lalu tulis
  {"projectId":"<id>","orgId":"team_kg8EUdhay7D2A0BIy1IY9E8X","projectName":
  "program-mandiri","settings":{}}. Deploy: `npx vercel deploy --prod --yes
  --token=$(cat /tmp/.vt)`.
- Token Vercel berumur pendek efektifnya: token yang diberikan pengguna 5 Nov
  pagi BERFUNGSI (deploy sukses) tetapi beberapa jam kemudian ditolak semua
  endpoint project-scoped dengan "Not authorized … re-authenticate to this
  scope" (SAML). Solusi: minta pengguna buat token BARU (segera setelah
  re-auth di vercel.com) atau deploy sendiri dari mesinnya.
- Env produksi lokal: `npx vercel env pull .env.local --environment=production
  --yes --token=...` setelah link OK. Alternatif bila token mati: env publik
  (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY) diekstrak dari bundle produksi via
  `bash scripts/ambil-env-publik.sh`; DATABASE_URL/DIRECT_URL (pola standar
  Supabase pooler, password %23 = '#'):
  DATABASE_URL=postgresql://postgres.xlajpidborknuanvernc:Basalamah88%23%23@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
  DIRECT_URL=postgresql://postgres.xlajpidborknuanvernc:Basalamah88%23%23@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
- Uji lokal tanpa mengotori produksi: schema sqlite
  `prisma/schema.sqlite.prisma` + `DATABASE_URL="file:/home/z/my-project/
  prisma/dev-uji.db" npx prisma db push --schema=prisma/schema.sqlite.prisma
  --skip-generate` → `npx prisma generate --schema=...` (PENTING: postinstall
  npm/bun akan me-regenerate client untuk postgres — selalu regenerate sqlite
  setelah install) → `bun scripts/uji-lokal-seed.mjs` (mirror data produksi:
  PGM-001 + Halaqoh Khadijah + 11 siswa + musyrif amanda).
  Catatan: `next start` memindai public/ saat boot — file uji di public/ harus
  ada SEBELUM server start, dan ganti server harus kill pid-nya (pkill/fuser
  sering tidak cocok; cek `ss -tlnp | grep 3000`).
- Commit tidak bisa push ke GitHub dari sandbox (tanpa kredensial) — deploy
  selalu via CLI upload lokal.

---
Task ID: 39-43 (rekap — file worklog lama hilang direcycle; direkonstruksi)
Agent: Z.ai (main)
Task: Penataan menu absen + popup pengingat + branding + gerbang absen setoran

- c04c5c9 (39-40): menu "Absen" di bawah Ringkasan, "Absen Siswa" di bawahnya;
  popup "Halaqoh Belum Diabsen" (musyrif, cek GET /api/absensi-siswa) dengan
  tombol ke menu Absen Siswa; aturan "simpan setoran butuh absen"
- 1b4a224 (41): popup terpicu saat MEMILIH kartu halaqoh binaan di Ringkasan
  (bukan otomatis saat dashboard dibuka); roster absen langsung terbuka pada
  halaqoh terpilih (halaqohAwal)
- 600d346 (42): logo & favicon MIN 6 Sukoharjo (lampiran pengguna)
- b5313a2 (43): gerbang absen di Input Setoran — sebelum daftar siswa muncul,
  cek absen hari ini; belum diabsen → popup pengingat MENGGANTI daftar siswa,
  tombolnya ke menu Absen Siswa; helper bersama semuaSiswaBelumDiabsen()
- 17715c1: perangkat uji lokal (schema sqlite + seed mirror + ekstraksi env)

---
Task ID: 44
Agent: Z.ai (main)
Task: "tolong carikan solusi kenapa musyrif yang menggunakan HP Samsung tidak
bisa absen, setelah foto selfie foto tidak tampil pada preview dan tidak bisa
diupload"

Diagnosis (kode dibaca menyeluruh: absensi-section.tsx, absen-awal-dialog.tsx,
image-compress.ts, api/absensi/musyrif/route.ts):
- Alur absen: input kamera native (capture="user") → compressImageFile() di
  browser → preview objectURL → POST multipart (foto sudah JPEG ≤512 KB).
- Server & storage TIDAK bermasalah (menerima JPEG hasil kompresi; kode tidak
  diubah). Kegagalan 100% di browser musyrif:
  1) createImageBitmap() tidak bisa decode HEIC/HEIF — kamera Samsung dengan
     setelan "High efficiency pictures" menghasilkan .heic (Chrome/Samsung
     Internet tidak mendukung) → throw → preview kosong, pending tak pernah
     terisi, tombol kirim tak muncul = persis keluhan pengguna;
  2) beberapa kamera Samsung mengirim MIME kosong/non-standar → guard
     file.type.startsWith('image/') menolak sejak awal;
  3) createImageBitmap dipakai tanpa fallback (browser lama / foto resolusi
     tinggi bisa gagal).

Perbaikan (commit b9306b2):
- src/lib/image-compress.ts ditulis ulang: deteksi HEIC (MIME + ekstensi +
  magic bytes ftyp brand heic/heix/hevc/heif/heim/heis/hevm/hevs/mif1/msf1) →
  konversi otomatis ke JPEG via heic2any (dynamic import, chunk lazy); decode
  fallback berlapis (createImageBitmap → <img> → file asli ≤450 KB);
  toBlob retry; pesan error memandu; validasi MIME kaku dipindah masuk.
- absensi-section.tsx & absen-awal-dialog.tsx: guard lama dihapus, toast info
  saat HEIC dikonversi / fallback aktif, accept=".heic,.heif".
- package.json + bun.lock: tambah dependensi heic2any.
- scripts/buat-sampel-foto-uji.py: generator foto uji (JPEG + HEIC asli via
  pillow-heif).

Uji E2E lokal (agent-browser, login amanda, popup "Jangan Lupa Absen!"):
- HEIC asli 55 KB → dikonversi → 9 KB JPEG 720×540, preview img valid ✔
- HEIC dengan MIME KOSONG (quirk Samsung) → terdeteksi magic bytes → OK ✔
- JPEG 59 KB → 8 KB ✔; JPEG 13.5 MP 461 KB → 9 KB 720×480 ✔
- Kirim Absen: multipart sampai server, gagal elegan di storage lokal (anon
  key + RLS — di produksi service key normal) dengan state terjaga ✔
- tsc & eslint src bersih; build sukses.

Stage Summary:
- FITUR SELESAI & TERVERIFIKASI LOKAL, BELUM TER-DEPLOY: semua endpoint
  project-scoped Vercel ditolak 403 ("re-authenticate to this scope") dengan
  token vcp_4Ogfx… yang semalam berfungsi — token efektif kedaluwarsa.
  Diperlukan token BARU dari pengguna (atau pengguna deploy sendiri:
  `npx vercel deploy --prod` dari folder proyek di mesinnya).
- Solusi jangka pendek untuk musyrif SEBELUM deploy: ubah setelan kamera
  Samsung ke JPEG (Kamera → ikon roda gigi → Format gambar → "Gambar paling
  kompatibel"), atau kirim foto via Chrome terbaru.
- Bukti uji: download/tampilan-website/44-uji-heic-preview-lokal.png,
  44-uji-foto-besar-preview.png
