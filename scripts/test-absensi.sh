#!/bin/bash
# Uji end-to-end fitur absensi musyrif terhadap dev server lokal (port 3000).
# Pemakaian: bash scripts/test-absensi.sh
set -uo pipefail
BASE=http://localhost:3000
JAR_M=/tmp/jar-musyrif.txt
JAR_A=/tmp/jar-admin.txt
rm -f "$JAR_M" "$JAR_A"

# Foto uji: 1 normal (±80 KB, simulasi hasil kompresi klien), 1 terlalu besar (>512 KB)
python3 - <<'PY'
from PIL import Image
import random
small = Image.new('RGB', (90, 120))
small.putdata([(random.randint(0,255), random.randint(0,255), random.randint(0,255)) for _ in range(90*120)])
small.resize((720, 960), Image.NEAREST).save('/tmp/selfie-uji.jpg', 'JPEG', quality=82)
small2 = Image.new('RGB', (200, 250))
small2.putdata([(random.randint(0,255), random.randint(0,255), random.randint(0,255)) for _ in range(200*250)])
small2.resize((1600, 2000), Image.NEAREST).save('/tmp/selfie-besar.jpg', 'JPEG', quality=100)
PY
echo "foto-uji: $(stat -c%s /tmp/selfie-uji.jpg) B, foto-besar: $(stat -c%s /tmp/selfie-besar.jpg) B"

pass=0; fail=0
cek() { # cek <nama> <hasil> <harapan>
  if [ "$2" = "$3" ]; then echo "✅ $1"; pass=$((pass+1)); else echo "❌ $1 (dapat=$2 harap=$3)"; fail=$((fail+1)); fi
}

echo "=== 1. Login musyrif (amanda) ==="
R=$(curl -s -c "$JAR_M" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identifier":"amanda","password":"musyrif123"}')
echo "$R" | head -c 160; echo
cek "login musyrif 200" "$(echo "$R" | rg -o '"role":"musyrif"' | head -1)" '"role":"musyrif"'

echo "=== 2. GET awal (belum absen) ==="
R=$(curl -s -b "$JAR_M" "$BASE/api/absensi/musyrif")
cek "hariIni null" "$(echo "$R" | rg -o '"hariIni":null')" '"hariIni":null'

echo "=== 3. POST tanpa file → 400 ==="
KODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_M" -X POST "$BASE/api/absensi/musyrif")
cek "POST tanpa file 400" "$KODE" "400"

echo "=== 4. POST foto >512KB → 400 ==="
KODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_M" -X POST "$BASE/api/absensi/musyrif" -F "file=@/tmp/selfie-besar.jpg;type=image/jpeg")
cek "POST foto besar 400" "$KODE" "400"

echo "=== 5. POST foto valid → 201 ==="
R=$(curl -s -b "$JAR_M" -X POST "$BASE/api/absensi/musyrif" -F "file=@/tmp/selfie-uji.jpg;type=image/jpeg" -F "keterangan=uji otomatis")
echo "$R" | head -c 220; echo
cek "status PENDING" "$(echo "$R" | rg -o '"status":"PENDING"')" '"status":"PENDING"'
cek "fotoUrl terisi" "$(echo "$R" | rg -o 'foto-absensi' | head -1)" 'foto-absensi'

echo "=== 6. GET kembali → hariIni ada ==="
R=$(curl -s -b "$JAR_M" "$BASE/api/absensi/musyrif")
cek "hariIni terisi" "$(echo "$R" | rg -o '"hariIni":\{"id"' )" '"hariIni":{"id"'

echo "=== 7. POST ulang (absen ulang) → 200 & tetap 1 record hari ini ==="
KODE=$(curl -s -o /tmp/reabsen.json -w '%{http_code}' -b "$JAR_M" -X POST "$BASE/api/absensi/musyrif" -F "file=@/tmp/selfie-uji.jpg;type=image/jpeg" -F "keterangan=uji ulang")
cek "POST ulang 200" "$KODE" "200"
N=$(curl -s -b "$JAR_M" "$BASE/api/absensi/musyrif" | rg -o 'uji otomatis' | wc -l)
cek "keterangan lama tertimpa" "$N" "0"

echo "=== 8. Musyrif akses endpoint admin → 403 ==="
KODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_M" "$BASE/api/absensi/admin")
cek "GET admin 403" "$KODE" "403"

echo "=== 9. Login admin ==="
R=$(curl -s -c "$JAR_A" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"identifier":"admin","password":"admin123"}')
cek "login admin" "$(echo "$R" | rg -o '"role":"admin"')" '"role":"admin"'

echo "=== 10. GET /api/absensi/admin?status=PENDING ==="
R=$(curl -s -b "$JAR_A" "$BASE/api/absensi/admin?status=PENDING")
ID=$(echo "$R" | rg -o '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
echo "id absen: $ID"
[ -n "$ID" ] && pass=$((pass+1)) || { echo "❌ id kosong"; fail=$((fail+1)); }

echo "=== 11. PATCH aksi invalid → 400 ==="
KODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_A" -X PATCH "$BASE/api/absensi/admin/$ID" -H 'Content-Type: application/json' -d '{"aksi":"MAYBE"}')
cek "PATCH invalid 400" "$KODE" "400"

echo "=== 12. PATCH TOLAK dengan catatan ==="
R=$(curl -s -b "$JAR_A" -X PATCH "$BASE/api/absensi/admin/$ID" -H 'Content-Type: application/json' -d '{"aksi":"TOLAK","catatan":"foto kurang jelas (uji)"}')
cek "status TOLAK" "$(echo "$R" | rg -o '"status":"TOLAK"')" '"status":"TOLAK"'

echo "=== 13. PATCH ACC (revisi) ==="
R=$(curl -s -b "$JAR_A" -X PATCH "$BASE/api/absensi/admin/$ID" -H 'Content-Type: application/json' -d '{"aksi":"ACC"}')
cek "status ACC" "$(echo "$R" | rg -o '"status":"ACC"')" '"status":"ACC"'

echo "=== 14. GET rekap (minggu & bulan terisi) ==="
R=$(curl -s -b "$JAR_A" "$BASE/api/absensi/admin/rekap")
echo "$R" | head -c 300; echo
cek "rekap minggu >=1" "$(echo "$R" | rg -o '"minggu":\[' | wc -l)" "1"
N=$(echo "$R" | rg -o '"jumlah":1' | wc -l)
[ "$N" -ge 2 ] && { echo "✅ minggu+bulan terisi"; pass=$((pass+1)); } || { echo "❌ rekap periode kurang ($N)"; fail=$((fail+1)); }

echo "=== 15. DELETE rekap minggu ini (hapus data uji + foto) ==="
SENIN=$(python3 -c "
from datetime import datetime, timedelta, timezone
now = datetime.now(timezone(timedelta(hours=7)))
d = now - timedelta(days=now.weekday())
print(d.strftime('%Y-%m-%d'))")
R=$(curl -s -b "$JAR_A" -X DELETE "$BASE/api/absensi/admin/rekap" -H 'Content-Type: application/json' -d "{\"tipe\":\"minggu\",\"nilai\":\"$SENIN\"}")
echo "$R"; echo
cek "deleted=1" "$(echo "$R" | rg -o '"deleted":1')" '"deleted":1'
cek "fotoDihapus=1" "$(echo "$R" | rg -o '"fotoDihapus":1')" '"fotoDihapus":1'

echo "=== 16. SETELAH DELETE: rekap kosong & GET musyrif hariIni null ==="
R=$(curl -s -b "$JAR_A" "$BASE/api/absensi/admin/rekap")
cek "total=0" "$(echo "$R" | rg -o '"total":0')" '"total":0'
R=$(curl -s -b "$JAR_M" "$BASE/api/absensi/musyrif")
cek "hariIni null lagi" "$(echo "$R" | rg -o '"hariIni":null')" '"hariIni":null'

echo ""
echo "===== HASIL: $pass lulus, $fail gagal ====="
exit $fail
