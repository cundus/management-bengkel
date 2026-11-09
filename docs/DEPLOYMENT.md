# Deploy WMC 225 ke Vercel + PostgreSQL

Panduan ini menggunakan **Prisma ORM** dengan PostgreSQL terkelola. Cocok untuk Neon, Vercel Postgres, Supabase, atau PostgreSQL mandiri.

## Ringkasan arsitektur production

```mermaid
flowchart LR
  Browser["Browser / PWA"] --> V["Vercel<br/>Next.js Serverless"]
  V --> P["Prisma Client<br/>(singleton per instance)"]
  P -->|DATABASE_URL<br/>pooled| PG[("PostgreSQL")]
  CLI["Mesin lokal / CI"] -->|DIRECT_URL| PG
  CLI -->|prisma migrate deploy| PG
```

- Aplikasi memakai **`DATABASE_URL`** (pooled).
- Prisma Migrate memakai **`DIRECT_URL`** (non-pooled).
- Tidak ada file database di filesystem Vercel. Semua state ada di PostgreSQL.

## 1. Provision PostgreSQL

### Neon

1. Buat project dan database `wmc225`.
2. Salin dua connection string:
   - **Pooled** → `DATABASE_URL`
     ```
     postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/wmc225?sslmode=require&pgbouncer=true&connection_limit=1
     ```
   - **Direct** → `DIRECT_URL`
     ```
     postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/wmc225?sslmode=require
     ```

### Supabase

- Pooled Transaction mode — port `6543`, tambahkan `?pgbouncer=true&connection_limit=1`.
- Direct connection — port `5432`.
- Gunakan SSL (`sslmode=require`).

### PostgreSQL mandiri

Gunakan dua URL; keduanya boleh sama jika tidak ada PgBouncer. Pastikan database dapat diakses dari Vercel (SSL, firewall/allowlist).

## 2. Environment variables

Set di **Vercel → Project → Settings → Environment Variables**.

| Key | Contoh | Wajib |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://...-pooler.../wmc225?pgbouncer=true&connection_limit=1` | ya |
| `DIRECT_URL` | `postgresql://.../wmc225?sslmode=require` | ya |
| `AUTH_SECRET` | random 48+ karakter | ya |
| `APP_TIMEZONE` | `Asia/Jakarta` | tidak |
| `NEXT_PUBLIC_APP_URL` | `https://wmc225.vercel.app` | tidak |

Jangan menaruh `ADMIN_PASSWORD`, `E2E_DATABASE_URL`, atau `TEST_DATABASE_URL` di production.

> `AUTH_SECRET` production harus berbeda dari development. Buat dengan password manager atau:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 3. Terapkan migrasi

Jalankan dari mesin lokal/CI yang punya akses ke database production. **Jangan** memakai `db:reset`.

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://...pooled..."
$env:DIRECT_URL="postgresql://...direct..."
pnpm db:deploy
```

Bash/macOS/Linux:

```bash
DATABASE_URL="postgresql://...pooled..." \
DIRECT_URL="postgresql://...direct..." \
pnpm db:deploy
```

`db:deploy` menjalankan `prisma migrate deploy`, yang hanya menerapkan migrasi yang belum ada dan tidak menghapus data.

## 4. Buat akun owner pertama

Production tidak boleh memakai data demo. Buat hanya akun pemilik:

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://...pooled..."
$env:DIRECT_URL="postgresql://...direct..."
$env:ADMIN_EMAIL="owner@wmc225.id"
$env:ADMIN_NAME="Pemilik WMC 225"
$env:ADMIN_PASSWORD="kata-sandi-kuat-minimal-8-karakter"
pnpm db:create-admin
```

Script ini melakukan upsert akun owner dan setting awal bengkel tanpa menambahkan pelanggan/transaksi demo.

## 5. Deploy Vercel

1. Push repository ke GitHub.
2. **Add New Project** di Vercel → import repo.
3. Framework terdeteksi **Next.js**.
4. Install command: `pnpm install` (postinstall otomatis `prisma generate`).
5. Build command: `pnpm build` (sudah termasuk `prisma generate`).
6. Tambahkan environment variables di atas untuk **Production** (dan Preview bila perlu).
7. Deploy.

Catatan:
- Vercel build **tidak** menjalankan migrasi. Jalankan langkah 3 sebelum deploy yang mengubah schema.
- Prisma Client di-generate di build Vercel untuk platform serverless.
- Di serverless, jangan membuat `new PrismaClient()` per request. Kode menggunakan singleton di `src/lib/db.ts`.

## 6. Setelah deploy

Checklist:

- [ ] Login owner berhasil dengan akun dari `db:create-admin`.
- [ ] Ubah nama bengkel/alamat/nota di **Pengaturan**.
- [ ] Cek `/laporan` dan pembuatan nota di production.
- [ ] Simpan URL dan kredensial di password manager.
- [ ] Aktifkan backup otomatis di provider database.
- [ ] Set budget/alert database.
- [ ] Pastikan `AUTH_SECRET` tidak pernah masuk git.

## Backup & pemulihan

PostgreSQL terkelola menyediakan backup otomatis (Neon branches/restore, Supabase backup, RDS snapshot, dll.). Minimal:

1. Aktifkan daily backup di provider.
2. Uji restore ke database staging secara berkala.
3. Untuk export manual: `pg_dump "$DATABASE_URL" --no-owner --format=custom > wmc225.dump`.
4. Restore: `pg_restore --clean --no-owner -d "$DATABASE_URL" wmc225.dump`.

**Jangan** mengandalkan filesystem Vercel untuk menyimpan apa pun.

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| `P1001: Can't reach database server` | URL salah / IP allowlist / SSL | Cek host, port, password, SSL; untuk Neon gunakan host pooler yang benar. |
| `prepared statement "s0" already exists` | Pooled connection tanpa mode PgBouncer | Tambahkan `?pgbouncer=true&connection_limit=1` pada `DATABASE_URL`. |
| `The table ... does not exist` | Migrasi belum dijalankan | Jalankan `pnpm db:deploy`. |
| `too many connections` | Memakai direct URL di serverless | Gunakan pooled URL dan batasi `connection_limit`. |
| `prisma generate` gagal di Vercel | `DATABASE_URL`/`DIRECT_URL` belum diset | Tambahkan env ke environment build Vercel. |
| Login production tidak bisa | Akun owner belum dibuat | Jalankan `pnpm db:create-admin` dengan env production. |
| Data demo muncul di production | Seed dijalankan | Reset DB production atau hapus data demo secara manual; jangan seed production. |
| `migrate dev` ingin membuat migrasi | Schema berubah di lokal | Buat migrasi di lokal, commit folder `prisma/migrations`, deploy. |

## Alur rilis yang disarankan

```text
development → prisma migrate dev (buat migration) → commit
          → preview deployment di Vercel + DB preview opsional
          → prisma migrate deploy ke production
          → deploy production
          → smoke test login + transaksi + laporan
```

Untuk rollback kode, gunakan **Instant Rollback** Vercel. Rollback database harus dipulihkan dari backup/point-in-time; migrasi tidak otomatis bisa dibalik.
