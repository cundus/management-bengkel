# Deploy ke Netlify

Project ini memakai Next.js server runtime dan PostgreSQL eksternal. Konfigurasi build ada di `netlify.toml`; Netlify otomatis memakai adapter Next.js.

## Environment

Set di Netlify sebelum build pertama:

| Variable | Nilai |
| --- | --- |
| `DATABASE_URL` | Prisma Postgres pooled URL (`pooled.db.prisma.io`) |
| `DIRECT_URL` | Prisma Postgres direct URL (`db.prisma.io`) |
| `AUTH_SECRET` | Secret acak minimal 32 karakter |
| `APP_TIMEZONE` | `Asia/Jakarta` |
| `NEXT_PUBLIC_APP_URL` | URL publik Netlify atau custom domain |

Variable server harus tersedia untuk build dan Functions. `.env.netlify.local` menyimpan konfigurasi deployment lokal dan diabaikan Git; jangan commit atau menyalin nilainya ke dokumentasi. Gunakan database terpisah untuk deploy preview.

## Database

Build Netlify menjalankan `pnpm db:deploy` (`prisma migrate deploy`) sebelum `pnpm build`, jadi migrasi baru diterapkan otomatis; jika migrasi gagal, deploy dibatalkan. Untuk menerapkan migrasi manual dari root project:

```powershell
node --env-file=.env.netlify.local node_modules/prisma/build/index.js migrate deploy
```

Buat akun pemilik pertama dengan `ADMIN_EMAIL`, `ADMIN_NAME`, dan `ADMIN_PASSWORD` yang diisi di environment terminal lokal:

```powershell
node --env-file=.env.netlify.local --import tsx prisma/create-admin.ts
```

Script admin melakukan upsert; memakai email akun yang sudah ada akan mengganti password dan role akun itu. Jangan jalankan seed demo atau reset database di production.

## Hosting

1. Push source dan lockfile ke `git@github.com:cundus/management-bengkel.git`.
2. Di Netlify, import repository tersebut dan pilih branch `main`.
3. Gunakan base directory root project. `netlify.toml` menetapkan Node 22, pnpm 9.15.9, build `pnpm db:deploy && pnpm build`, dan publish `.next`.
4. Isi environment, lalu deploy. Build menerapkan migrasi lalu menjalankan Prisma Generate; pastikan `DATABASE_URL` dan `DIRECT_URL` tersedia saat build.
5. Isi `NEXT_PUBLIC_APP_URL` sesuai URL final dan rebuild bila berubah.
6. Cek login owner, pembuatan nota, pembayaran, stok, dan laporan. Aktifkan backup di provider database.

Untuk memeriksa build lokal dengan environment deployment:

```powershell
node --env-file=.env.netlify.local node_modules/next/dist/bin/next build
```

Jalankan `pnpm db:generate` terlebih dahulu jika Prisma schema berubah. Domain sendiri opsional.
