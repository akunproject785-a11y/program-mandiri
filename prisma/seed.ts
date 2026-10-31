/**
 * DEPRECATED — sejak integrasi Supabase, kredensial dikelola Supabase Auth
 * dan data awal (admin/musyrif/bucket/realtime) disiapkan lewat
 * scripts/supabase-seed.mjs + scripts/supabase-setup-sql.mjs.
 * Script ini tidak lagi membuat data apa pun.
 */
async function main() {
  console.log(
    'prisma/seed.ts sudah tidak dipakai lagi.\n' +
      'Gunakan: bun scripts/supabase-seed.mjs  (akun auth + verifikasi profil)\n' +
      'dan:     scripts/supabase-setup-sql.mjs (policy RLS + publication realtime)'
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
