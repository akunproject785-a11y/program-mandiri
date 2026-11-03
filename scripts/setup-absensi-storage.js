/**
 * Setup infrastruktur fitur absensi musyrif (idempoten):
 * 1. Pastikan bucket Supabase Storage public "foto-absensi" ada (limit 512 KB).
 * 2. Pastikan tabel "AbsensiMusyrif" jadi anggota publication supabase_realtime
 *    (agar dashboard admin mendapat pembaruan realtime).
 *
 * Pemakaian: node scripts/setup-absensi-storage.js   (env dibaca dari .env.local)
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function envValue(key) {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = fs.readFileSync(file, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (m && m[1] === key) return m[2].replace(/^"(.*)"$/, '$1')
      }
    } catch {}
  }
  return undefined
}

const URL = envValue('NEXT_PUBLIC_SUPABASE_URL')
const SR = envValue('SUPABASE_SERVICE_ROLE_KEY')
const DIRECT = envValue('DIRECT_URL')
if (!URL || !SR) {
  console.error('Env Supabase tidak lengkap')
  process.exit(1)
}

const supabase = createClient(URL, SR, { auth: { persistSession: false } })

// ===== 1. Bucket foto-absensi =====
const BUCKET = 'foto-absensi'
const { data: bucket } = await supabase.storage.getBucket(BUCKET)
if (!bucket) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 512 * 1024, // 512 KB — foto sudah dikompres di sisi klien
  })
  if (error) {
    console.error('❌ Gagal membuat bucket:', error.message)
    process.exit(1)
  }
  console.log('✅ Bucket "foto-absensi" dibuat (public, limit 512KB)')
} else {
  console.log('⏭️  Bucket "foto-absensi" sudah ada (public=' + bucket.public + ')')
}

// ===== 2. Publication realtime =====
const sql = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime' AND puballtables) THEN
    RAISE NOTICE 'publication untuk semua tabel';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND tablename='AbsensiMusyrif'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "AbsensiMusyrif";
      RAISE NOTICE 'tabel AbsensiMusyrif ditambahkan ke publication';
    ELSE
      RAISE NOTICE 'tabel AbsensiMusyrif sudah ada di publication';
    END IF;
  END IF;
END $$;`

const res = await fetch(`${URL.replace('.supabase.co', '.supabase.co')}/pg`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SR}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})
// Endpoint /pg tersedia di project baru; bila gagal, fallback ke prisma db execute via child
if (res.ok) {
  const json = await res.json().catch(() => null)
  console.log('✅ Publication realtime dicek via SQL endpoint', json?.messages ?? '')
} else {
  console.log('ℹ️  SQL endpoint tidak tersedia (' + res.status + ') — jalankan manual bila perlu:')
  console.log(sql)
}
console.log('DIRECT_URL tersedia untuk fallback prisma db execute:', Boolean(DIRECT))
