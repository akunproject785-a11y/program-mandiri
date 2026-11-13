#!/bin/bash
# Ambil env PUBLIK (klien) dari bundle produksi — nilai ini memang terkirim
# ke browser (anon key dilindungi RLS), jadi aman diekstrak untuk uji lokal.
set -u
B="https://program-mandiri.vercel.app"
OUT="/tmp/env-publik.txt"
: > "$OUT"

HTML=$(curl -s "$B/")
CHUNKS=$(echo "$HTML" | grep -oE '/_next/static/[^"]+\.js' | sort -u)
echo "chunk ditemukan: $(echo "$CHUNKS" | wc -l)"

for c in $CHUNKS; do
  curl -s "$B$c" >> /tmp/bundle-all.js 2>/dev/null
done

URL=$(grep -oE 'https://[a-z0-9]+\.supabase\.co' /tmp/bundle-all.js | head -1)
# Anon key dipanggil berdampingan dengan URL pada createBrowserClient — ambil
# string tepat setelah URL (regex JWT naif sering meleset karena potongan
# chunk/encoding). Ref proyek di-hardcode sesuai deployment saat ini.
KEY=$(python3 - <<'PYEOF'
import re
s = open('/tmp/bundle-all.js', encoding='utf-8', errors='ignore').read()
i = s.find('"https://xlajpidborknuanvernc.supabase.co"')
m = re.match(r'"https://xlajpidborknuanvernc\.supabase\.co"\s*,\s*"([^"]+)"', s[i:i+600]) if i >= 0 else None
print(m.group(1) if m else '')
PYEOF
)
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$KEY"
} > "$OUT"
# cetak hanya potongan aman untuk verifikasi
echo "URL: $URL"
echo "ANON_KEY: ${KEY:0:24}… (panjang ${#KEY})"
# validasi JWT anon key: payload harus berisi role=anon
python3 - "$KEY" <<'EOF'
import sys, json, base64
k = sys.argv[1] if len(sys.argv) > 1 else ''
try:
    p = k.split('.')[1]
    p += '=' * (-len(p) % 4)
    d = json.loads(base64.urlsafe_b64decode(p))
    print('ref:', d.get('ref'), '| role:', d.get('role'))
except Exception as e:
    print('parse gagal:', e)
EOF
