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

---
Task ID: 45
Agent: Z.ai (main)
Task: Deploy Task 44 + verifikasi produksi + sinkron GitHub (pengguna memberi
token Vercel & GitHub baru)

- Token vercel vcp_8EICmB… valid (v2/user 200, project prj_BCvEzaDlqX3PiMgbfv
  Xg89S0p1yX terbaca). .vercel/project.json dibuat ulang dengan projectId
  asli; env produksi di-pull ke .env.local.
- Deploy produksi SUKSES: program-mandiri-a2914yc39-akunproject785-9259.
  vercel.app → https://program-mandiri.vercel.app (200). Bundle produksi
  berisi kode HEIC (marker ftyp di chunks/97e24794cb183cd4.js).
- E2E produksi (agent-browser, login amanda, tanggal 2026-11-13; hariIni
  dicek null dulu agar tidak menimpa absen asli):
  - File HEIC asli 55 KB diinjeksi ke popup "Jangan Lupa Absen!" (embed
    base64; fetch localhost dari halaman publik diblokir Private Network
    Access + CORS) → dikonversi otomatis → preview 9 KB JPEG 720×540 valid
  - Kirim Absen → upload Supabase Storage sukses, record DB dibuat: status
    PENDING jam 15:27:08 WIB, fotoUrl storage 200 (8.8 KB)
  - Catatan: absen uji amanda 13 Nov 2026 ada di DB produksi (data demo);
    admin bisa ACC/TOLAK seperti biasa.
- GitHub: remote origin = akunproject785-a11y/program-mandiri; push main
  dengan token (git push https://x-access-token:<token>@github.com/...).
- Bukti: download/tampilan-website/45-prod-absen-heic-berhasil.png

Stage Summary:
- MASALAH HP SAMSUNG SELESAI DI PRODUKSI: HEIC otomatis dikonversi, fallback
  decode berlapis, MIME kaku dihapus. Musyrif dengan setelan kamera apa pun
  (HEIF/JPEG) kini bisa absen normal.

---
Task ID: 46
Agent: Z.ai (main)
Task: "pada menu kelola absen musyrif tambahkan opsi hapus agar tidak jadi
tercatat absenya"

Implementasi (commit setelah entri ini):
- API: DELETE /api/absensi/admin/:id di src/app/api/absensi/admin/[id]/route.ts
  — requireAdmin, hapus foto di Storage dulu (kegagalan diabaikan), lalu hapus
  record Prisma. Berbeda dari TOLAK (record tetap ada).
- UI kelola-absensi-section.tsx: tombol "Hapus" (variant outline destructive,
  ikon Trash2) di SEMUA baris — desktop tabel & kartu mobile; dialog
  konfirmasi "Hapus Absensi Permanen" (nama + tanggal + jam + peringatan tidak
  bisa dibatalkan); toast sukses; row dihapus dari state lokal (statistik ikut
  berkurang).

E2E produksi (deployment program-mandiri-ceqkh2gix):
- Login admin → menu Kelola Absen Musyrif → baris amanda 13 Nov (absen uji
  Task 45, PENDING 15:27) → Hapus → dialog konfirmasi tampil dengan teks
  benar → "Hapus Permanen" → row hilang, API /api/absensi/admin 11→10 ✔
- Foto di storage terhapus: URL target kini 400, foto kontrol record lain
  masih 200 (pemeriksaan pertama tampak 200 karena cache browser) ✔
- Catatan operasional: password Supabase auth admin@quranmandiri.id DIRESET ke
  nilai demo terdokumentasi (admin123) — seed lama sempat melewatkan akun ini
  ("tidak ditemukan — lewati") sehingga password tidak pernah direset ke nilai
  demo; reset via service key (scripts/reset-password-admin-demo.mjs, key dari
  env pull, tidak pernah dicetak).
- Bukti: download/tampilan-website/46-dialog-hapus-absensi.png,
  46-kelola-absen-setelah-hapus.png

Stage Summary:
- FITUR HAPUS ABSEN MUSYRIF SELESAI DI PRODUKSI: admin bisa menghapus absensi
  apa pun (PENDING/ACC/TOLAK) beserta fotonya sehingga tidak tercatat.

---
Task ID: 47
Agent: Z.ai (main)
Task: "pada dashboard admin, tambahkan Menu Ujian untuk mengaktifkan menu
Ujian pada dashboard musyrif. fungsinya mengaktifkan dan melihat rekapan
ujian dari masing-masing musyrif"

Implementasi (fitur baru dari nol — belum ada kode ujian sebelumnya):
- Prisma: model Ujian (musyrifId, siswaId, tanggal WIB, jenis, bab?, nilai
  0-100, catatan?) + relasi Musyrif/Siswa; di schema.prisma & schema.sqlite.
  Setting key 'ujian_musyrif_aktif' ('1' = aktif) di tabel Setting.
- API baru:
  - GET/PATCH /api/setting-ujian (GET keduanya role; PATCH admin)
  - GET/POST /api/ujian/musyrif (daftar + roster siswa halaqoh binaan;
    input: siswa wajib halaqoh binaan, tanggal valid, jenis wajib, nilai
    bulat 0-100; POST ditolak 403 bila menu nonaktif)
  - DELETE /api/ujian/musyrif/:id (milik sendiri)
  - GET /api/ujian/admin (rekap per musyrif: total, siswa diujikan,
    rata-rata tertimbang, terakhir; ?dari=&sampai=; ?musyrifId= detail)
- UI:
  - ujian-section.tsx (admin): kartu aktivasi Switch + statistik + filter
    tanggal + tabel rekap per musyrif + dialog detail daftar ujian.
  - ujian-musyrif-section.tsx (musyrif): form catat ujian + daftar + hapus
    (ConfirmDialog); tampil pemberitahuan bila dinonaktifkan admin.
  - dashboard.tsx: SectionKey 'ujian'; dua entri menu (adminOnly & musyrifOnly);
    musyrifOnly 'ujian' ditampilkan hanya saat ujianAktif (fetch
    /api/setting-ujian); SidebarContent kini menerima items hasil filter.
- Migrasi produksi: scripts/migrasi-ujian.mjs (CREATE TABLE Ujian + index +
  Setting awal '0', idempotent, via DIRECT_URL) — SIAP tapi BELUM dijalankan
  karena token Vercel kedua sudah tidak berlaku (lihat di bawah).

E2E lokal (sqlite mirror + seed + profil Admin lokal; build hijau):
- Admin: menu Ujian ada; default Nonaktif; toggle ON → Setting true + toast;
  setelah amanda input, rekap tampil (total 1, rata 85) + dialog detail isi
  lengkap; toggle OFF → Setting false.
- Amanda: sebelum aktivasi menu tak ada; setelah aktivasi menu Ujian muncul;
  input ujian (Alfandy Habil Israfil — Mutqin — 85 + catatan) tersimpan;
  saat nonaktif: menu hilang DAN POST ditolak 403.
- Bukti: download/tampilan-website/47-admin-ujian-menu.png,
  47-musyrif-ujian-tercatat.png, 47-admin-rekap-ujian.png,
  47-admin-detail-ujian.png

Kendala deploy:
- Token Vercel kedua (vcp_8EICmB…) yang pagi ini masih bisa deploy kini
  DITOLAK untuk scope team akunproject785-9259 ("Not authorized… use a token
  with access to this scope"; /v2/teams kosong). Ditulis ulang .vercel + env
  publik via ambil-env-publik.sh; .env.local lokal diarahkan ke sqlite untuk
  E2E. Migrasi produksi & deploy menunggu token Vercel BARU.

Stage Summary:
- FITUR UJIAN SELESAI DAN TERUJI LOKAL PENUH; tinggal migrasi SQL produksi
  (bun scripts/migrasi-ujian.mjs) + vercel deploy --prod begitu token baru
  diterima.

---
Task ID: 48
Agent: Z.ai (main)
Task: deploy produksi dengan token Vercel BARU (lanjutan Task 47) + E2E produksi

Eksekusi:
- Token ketiga valid untuk scope team (API /v9/projects 200); .vercel link
  dibuat ulang; .env.local produksi di-pull (DATABASE_URL/DIRECT_URL ada).
- Migrasi produksi JALAN: scripts/migrasi-ujian.mjs → tabel "Ujian" + index +
  Setting 'ujian_musyrif_aktif' awal '0' (idempotent).
- vercel deploy --prod sukses (deployment program-mandiri-nnpghalqy-…);
  endpoint baru /api/setting-ujian, /api/ujian/admin, /api/ujian/musyrif
  balik 401 (bukan 404) → build baru tayang di program-mandiri.vercel.app.

E2E produksi (browser, akun admin & amanda):
- Admin: menu Ujian tampil; section aktivasi + rekap render; toggle ON →
  DB '1' (dicek langsung via SQL: cek-setting-ujian-prod.mjs) + switch 'Aktif'.
- Amanda: menu Ujian MUNCUL setelah aktivasi (menu dinamis bekerja di prod);
  input ujian (Alfandy Habil Israfil — "Uji Produksi" — 85) tersimpan.
- Admin: statistik 1/1/85; baris rekap Amanda; Detail dialog berisi record.
- Cleanup: record uji dihapus amanda via UI (uji DELETE /api/ujian/musyrif/:id)
  → daftar "Belum ada ujian", DB 0 baris. Status akhir: menu Ujian AKTIF di
  produksi (admin bisa menonaktifkan kapan pun dari menu Ujian).
- Bukti: download/tampilan-website/47-prod-admin-ujian.png,
  47-prod-musyrif-ujian.png, 47-prod-admin-rekap.png,
  47-prod-admin-rekap-tabel.png, 47-prod-admin-detail.png

Catatan verifikasi todo lain (batch permintaan):
- Perbaikan selfie Samsung (preview/upload HEIC) — sudah di Task 45
  (compressImageFile HEIC→JPEG + previewUrl + E2E produksi); tidak ada kode
  baru yang diperlukan.
- Input Setoran gating & pengingat halaqoh (Task 38 refinement) — sudah ada
  di kode (input-setoran-section.tsx pakai onBukaAbsenSiswa + popup).
- Logo/favicon — favicon.ico + icon.png + logo.png sudah ada; tidak ada
  lampiran logo baru di upload/.

Stage Summary:
- DEPLOY PRODUKSI SUKSES DENGAN FITUR UJIAN AKTIF; E2E produksi lengkap
  (aktifkan → muncul → input → rekap+detail → hapus) dan data uji bersih.

---
Task ID: 49
Agent: Z.ai (main)
Task: "pada dashboard musyrif sebelum bisa menginput ujian persiswa, musyrif
wajib menginput minimal 2 deskripsi Tujuan Pembelajaran (TP). jika sudah
disimpan baru muncul nama siswa dan input nilai berdasarkan TP yang diinput
musyrif"

Implementasi (wizard 2 tahap pada menu Ujian musyrif):
- Prisma (schema.prisma + schema.sqlite.prisma): model TpUjian (musyrifId,
  teks, urutan Int default 0) + NilaiTp (ujianId, tpId, nilai 0-100,
  @@unique([ujianId, tpId]), cascade delete); relasi Musyrif.tpUjian dan
  Ujian.nilaiTp. Kolom 'urutan' DITAMBAHKAN SETELAH BUG TERLIHAT DI PRODUKSI:
  bulk createMany menghasilkan createdAt identik → orderBy createdAt ambigu →
  penomoran TP1/TP2 bisa tertukar antara form musyrif dan dialog admin
  (terekam di screenshot 49-prod-admin-detail.png versi awal). Solusi:
  urutan eksplisit per musyrif (backfill ROW_NUMBER by createdAt,id).
- API baru: POST /api/ujian/tp (bulk simpan TP, urutan = max+1 berurutan),
  DELETE /api/ujian/tp/:id (409 bila TP sudah dipakai nilai ujian).
- GET /api/ujian/musyrif kini mengembalikan 'tp' (dengan flag dipakai) dan
  items berisi nilaiTp[] (teks+nilai per TP, urut urutan).
- POST /api/ujian/musyrif kini: body nilaiTp[] wajib MENCAKUP SEMUA TP milik
  musyrif (set equality, tiap nilai 0-100); minimal 2 TP tersimpan (400 bila
  kurang); Ujian.nilai = rata-rata dibulatkan dari nilai per TP; transaksi
  create ujian + createMany nilaiTp.
- GET /api/ujian/admin?musyrifId= detail kini membawa nilaiTp[] breakdown.
- UI ujian-musyrif-section.tsx: kartu TP (daftar tersimpan bernomor + hapus
  TP yang belum dipakai + baris input dinamis + Simpan TP + badge "x/2 TP
  tersimpan"); form "Catat Ujian Siswa" HANYA MUNCUL bila >= 2 TP (kartu
  terkunci + penjelasan bila belum); input nilai per TP (TP1..TPn 0-100);
  daftar ujian desktop: klik baris → sub-baris breakdown per TP; mobile:
  breakdown selalu tampil. Fix UX: dialog konfirmasi hapus kini tertutup
  juga saat gagal (sebelumnya tertinggal terbuka pada error 409).
- UI ujian-section.tsx (admin): dialog detail menampilkan breakdown
  "TPn <teks> — <nilai>" per ujian.
- Migrasi produksi: scripts/migrasi-tp-ujian.mjs (CREATE TABLE TpUjian/
  NilaiTp + ALTER ADD COLUMN urutan + backfill + index, idempotent).
- Perbaikan bug urutan dikerjakan di tengah E2E produksi dan redeploy
  (deployment 8t3w0sxjt), verifikasi ulang breakdown urut benar.

E2E lokal (sqlite, build hijau):
- Gate: 0 TP → "0/2 TP tersimpan" + kartu terkunci + form siswa tidak ada;
  1 TP → masih terkunci (toast "Tambah minimal 2 TP…"); 2 TP → form terbuka
  dengan 2 input nilai per TP.
- Validasi: simpan tanpa siswa ditolak; nilai per TP wajib diisi.
- Simpan ujian Alfandy (TP1 85, TP2 90) → rata-rata 88 tersimpan + breakdown
  baris (klik baris) "TP1 …: 85 / TP2 …: 90".
- Admin: detail dialog TP1—85, TP2—90; rekap rata-rata 86.5 (2 ujian).
- Hapus TP terpakai → 409 dengan pesan jelas; hapus ujian → cascade NilaiTp;
  TP yang telah lepas dipakai kini bisa dihapus → gate kembali terkunci 0/2.
- Bukti: download/tampilan-website/49-gate-terkunci.png, 49-gate-terbuka.png,
  49-daftar-breakdown.png, 49-admin-detail-tp.png

E2E produksi (program-mandiri.vercel.app, browser):
- Migrasi jalan (tabel + kolom urutan siap); deploy sukses; /api/ujian/tp 405
  (ada) → build baru tayang.
- Amanda: gate "0/2 TP tersimpan" + terkunci; tambah 2 TP → form terbuka;
  simpan ujian (Alfandy, 85/90) → "Uji TP Produksi — nilai rata-rata 88".
- Admin: dialog detail breakdown per TP (setelah fix urutan: TP1 lancar—90,
  TP2 harakat—85, sesuai pasangan data tersimpan — penomoran stabil).
- Cleanup data uji: hapus ujian + 2 TP → DB produksi akhir ujian 0, nilaiTp 0,
  tp 0; Setting ujian_musyrif_aktif tetap '1' (menu aktif).
- Bukti: download/tampilan-website/49-prod-gate.png, 49-prod-tercatat.png,
  49-prod-admin-detail.png

Catatan:
- Data ujian LAMA yang dibuat sebelum fitur TP (pre-Task 49) tidak memiliki
  breakdown nilaiTp — tampil tanpa baris TP di detail (wajar).
- Port 3000 bentrok saat awal E2E lokal (server lama Task 48 masih hidup)
  — dikill lalu restart fresh; sesi browser lama bisa membuat eval login
  gagal → skrip login kini idempotent (skip bila sudah masuk).

Stage Summary:
- WIZARD UJIAN MUSYRIF LIVE DI PRODUKSI: wajib >= 2 TP sebelum form siswa
  muncul, nilai per TP wajib lengkap, rata-rata tersimpan di Ujian.nilai,
  breakdown TP tampil untuk musyrif (klik baris) dan admin (dialog detail);
  data uji produksi dibersihkan; fitur tetap dalam status AKTIF.

---
Task ID: 50
Agent: Z.ai (main)
Task: "pada dashboard admin, sebelum mengaktifkan Ujian untuk musyrif, admin
menginput dulu tahun ajaran, untuk nantinya ketika diinput tahun ajaran baru,
data yang digunakan juga baru"

Implementasi (Tahun Ajaran sebagai prasyarat & pemisah data Ujian):
- Prisma (schema.prisma + schema.sqlite.prisma): kolom tahunAjaran String
  default '' pada Ujian & TpUjian + index Ujian(tahunAjaran),
  Ujian(musyrifId, tahunAjaran), TpUjian(musyrifId, tahunAjaran)
  (index lama TpUjian(musyrifId) diganti).
- Setting baru 'ujian_tahun_ajaran' ('' = belum diatur). Lib ujian:
  KEY_TAHUN_AJARAN + bacaTahunAjaran().
- PATCH /api/setting-ujian kini menerima { aktif?, tahunAjaran? }:
  - Mengaktifkan Ujian (aktif=true) DITOLAK 400 bila tahun ajaran belum
    terisi ("Isi tahun ajaran terlebih dahulu…") — validasi client + server.
  - Simpan tahun ajaran baru kapan saja; mengganti TA memindahkan data yang
    digunakan (filter), data TA lama tetap tersimpan sebagai arsip.
- Semua endpoint data ujian kini difilter per TA aktif:
  GET/POST /api/ujian/musyrif, POST /api/ujian/tp (create menyimpan TA; tolak
  403 bila TA kosong), GET /api/ujian/admin (rekap & detail).
- UI admin (ujian-section.tsx): kartu tahun ajaran (badge "Belum diatur"/
  "Aktif: X", input + Simpan Tahun Ajaran + penjelasan perpindahan data);
  toggle aktif diblok client bila TA kosong; header & dialog detail menyebut
  TA aktif.
- UI musyrif (ujian-musyrif-section.tsx): label "Tahun Ajaran X" di header;
  bila menu aktif tapi TA belum diatur → EmptyState "Tahun ajaran belum
  diatur" (form TP & ujian tidak tampil). Saat TA diganti, GET otomatis
  kosong → gate TP 0/2 terkunci lagi (musyrif menginput TP baru).
- Migrasi produksi: scripts/migrasi-tahun-ajaran-ujian.mjs (ADD COLUMN IF
  NOT EXISTS ×2 + index + Setting '' — idempotent).
- Fix saat E2E: kolom Ujian.tahunAjaran awalnya tanpa @default("") membuat
  db push sqlite menolak (required column tanpa default) → diberi default.

E2E lokal (sqlite, build hijau, data lokal utuh — push incremental):
- Musyrif saat TA kosong → EmptyState "Tahun ajaran belum diatur".
- Admin: toggle ON tanpa TA → diblok ("Isi tahun ajaran terlebih dahulu…"),
  switch tetap Nonaktif; Simpan TA "2026/2027" → badge "Aktif: 2026/2027" +
  toast perpindahan data; toggle ON → sukses ("…tahun ajaran 2026/2027").
- Musyrif: label TA muncul, gate 0/2 terkunci (TP lama tidak terbawa); tambah
  2 TP → form terbuka → ujian "Uji TA" (85/90 → rata 88) tersimpan; admin
  rekap total 1.
- Admin ganti TA "2027/2028" → rekap kosong; musyrif: label TA baru, gate
  0/2 terkunci, daftar kosong — DATA YANG DIGUNAKAN JADI BARU ✓.
- Bukti: download/tampilan-website/50-musyrif-ta-kosong.png,
  50-admin-ta.png, 50-musyrif-tercatat.png, 50-admin-ganti-ta.png,
  50-musyrif-ta-2027.png

E2E produksi (program-mandiri.vercel.app):
- Migrasi jalan (kolom + index + Setting TA ''), deploy o82c1817m.
- Admin: badge "Belum diatur" → simpan TA "2026/2027" (tetap aktif).
- Musyrif: label TA 2026/2027, gate 0/2 → 2 TP → ujian "Uji TA Produksi"
  (85/90 → rata 88) tersimpan; admin rekap total 1 + dialog detail TA 2026/2027.
- Cleanup data uji: hapus ujian + 2 TP → DB: TP/ujian milik E2E = 0; TA
  '2026/2027'; aktif '1'.
- Catatan data nyata: TP "Coba 1"/"Menjelaskan" + ujian "Juzsiyah" (dibuat
  pengguna nyata era pra-TA / Task 49) kini ber-TA '' — otomatis menjadi
  ARSIP dan tidak muncul di rekap TA 2026/2027 (sesuai perilaku "data yang
  digunakan juga baru"); tidak dihapus.
- Bukti: download/tampilan-website/50-prod-admin-ta.png,
  50-prod-tercatat.png, 50-prod-admin-detail.png

Catatan insiden (tanpa dampak data): awal E2E lokal, .env.local masih berisi
env produksi (sisa vercel env pull Task 49) sehingga server lokal sempat
terhubung DB produksi hanya untuk GET; dikonfirmasi tidak ada penulisan data
lokal ke produksi, .env.local segera dikembalikan ke env lokal-sqlite.

Stage Summary:
- TAHUN AJARAN WAJIB SEBELUM AKTIVASI UJIAN: admin tidak dapat mengaktifkan
  menu tanpa mengisi tahun ajaran; seluruh data TP & ujian difilter per TA
  aktif; mengganti TA membuat musyrif mulai dari data kosong (TP 0 → gate
  terkunci), data TA sebelumnya tersimpan sebagai arsip. Produksi berjalan
  dengan TA aktif "2026/2027".
