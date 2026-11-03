"""Proyeksi pemakaian: 20 musyrif aktif harian, 150 siswa, 30 hari/bulan.
Dibandingkan dengan limit Supabase Free (500MB DB, 1GB storage, 5GB egress)
dan Vercel Hobby (100GB transfer, 1M invocations, 4h Active CPU).
Semua angka asumsi ditandai; hasil dipakai untuk analisis limit."""

# --- Asumsi skenario (sumber: kode aplikasi & kebiasaan pemakaian) ---
HARI = 30
MUSYRIF = 20
SISWA = 150

setoran_per_hari = SISWA              # tiap siswa ±1 setoran/hari
absen_siswa_per_hari = SISWA          # absensi siswa harian
selfie_per_hari = MUSYRIF             # absen musyrif + selfie

ukuran_baris_setoran = 1.0            # KB (row + index overhead, konservatif)
ukuran_baris_absensi = 0.5            # KB
selfie_kb = 90                        # KB (kompres 720px q0.72: 60-120 KB)
foto_siswa_kb = 500                   # KB rata-rata, maks 2MB, sekali unggah

egress_foto_siswa_per_hari = 15 * 1024    # KB: ±150 foto siswa dilihat/hari
egress_selfie_review_per_hari = selfie_per_hari * selfie_kb
egress_lain_per_hari = 2 * 1024           # KB: JSON/rekap dsb.

# --- Proyeksi bulanan ---
tumbuh_db_mb = (setoran_per_hari * ukuran_baris_setoran + absen_siswa_per_hari * ukuran_baris_absensi) * HARI / 1024
storage_selfie_mb = selfie_per_hari * selfie_kb * HARI / 1024
storage_foto_siswa_mb = SISWA * foto_siswa_kb / 1024  # sekali (onboarding)
egress_supabase_gb = (egress_foto_siswa_per_hari + egress_selfie_review_per_hari + egress_lain_per_hari) * HARI / 1024 / 1024

user_aktif = MUSYRIF + 5  # + admin/amanda dkk
transfer_vercel_gb = user_aktif * 7.5 * HARI / 1024      # ±7,5 MB/user/hari (aset+API)
invokasi_vercel = user_aktif * 100 * HARI                # ±100 panggilan API/user/hari
cpu_vercel_jam = invokasi_vercel * 0.075 / 3600          # ±75 ms CPU per invokasi

inv_realtime_msg = 20 * 8 * HARI  # notifikasi realtime, ±8 event/hari

print(f"Tumbuh DB           : {tumbuh_db_mb:6.1f} MB/bulan  -> capai 500 MB dalam {500/tumbuh_db_mb:5.1f} bulan")
print(f"Storage selfie      : {storage_selfie_mb:6.1f} MB/bulan  (tanpa pembersihan)")
print(f"Storage foto siswa  : {storage_foto_siswa_mb:6.1f} MB (sekali, onboarding 150 siswa)")
total_storage_bulan1 = storage_selfie_mb + storage_foto_siswa_mb
print(f"Storage total bln-1 : {total_storage_bulan1:6.1f} MB -> capai 1 GB dalam {1024/max(storage_selfie_mb,0.01):5.1f} bulan (selfie saja)")
print(f"Egress Supabase     : {egress_supabase_gb:6.2f} GB/bulan -> dari 5 GB")
print(f"Transfer Vercel     : {transfer_vercel_gb:6.2f} GB/bulan -> dari 100 GB")
print(f"Invocations Vercel  : {invokasi_vercel:9,} /bulan -> dari 1.000.000")
print(f"Active CPU Vercel   : {cpu_vercel_jam:6.2f} jam/bulan -> dari 4 jam")
print(f"Pesan Realtime      : {inv_realtime_msg:9,} /bulan -> dari 2.000.000")
print(f"MAU (auth)          : {user_aktif:9,} /bulan -> dari 50.000")

# --- Skenario Active CPU (Fluid Compute: hanya CPU aktif yang ditagih, I/O gratis) ---
print("\n== Skenario Active CPU (4 jam/bulan Hobby) ==")
cpu_per_invokasi = 0.075  # detik CPU aktif per panggilan API (routing+serialize; I/O DB tak ditagih)
for label, n_user, per_hari in [
    ("Sekarang (25 pengguna)", 25, 100),
    ("Tumbuh 2x (40+ pengguna)", 40, 100),
    ("Tumbuh 4x (25 pengguna, traffic x4)", 25, 400),
    ("BAHAYA: +polling tiap 30 detik saat jam kerja", 25, 100 + 960),
]:
    inv = n_user * per_hari * HARI
    jam = inv * cpu_per_invokasi / 3600
    print(f"{label:46s}: {inv:9,} invokasi -> {jam:5.2f} jam CPU ({jam/4*100:5.1f}% dari 4 jam)")
