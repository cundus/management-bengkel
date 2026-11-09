# Riset Repo GitHub & Keputusan Teknis

Tanggal riset: **9 November 2026**. Pencarian menggunakan GitHub CLI/API (query domain bengkel, POS, workshop management, Next.js starter/auth). Jumlah bintang berubah dari waktu ke waktu; angka di bawah adalah snapshot saat riset.

## Ringkasan eksekutif

Tidak ada repo yang memenuhi seluruh kebutuhan **web app bengkel + mobile-first + pencatatan piutang/hutang + lisensi jelas + stack modern** secara langsung. Repo bengkel yang ditemukan mayoritas berupa proyek akademik/eksperimen (Laravel, Flutter, Go) tanpa lisensi, sedangkan boilerplate populer terlalu berat (Clerk, Postgres, Sentry, Storybook) atau tidak memiliki domain bengkel.

**Keputusan:** membangun aplikasi sendiri dengan Next.js 16 + Prisma + PostgreSQL agar siap deploy di Vercel, mengambil *pola* (bukan kode) dari proyek-proyek berikut. Tidak ada kode dari repo tanpa lisensi yang disalin.

## Repo domain bengkel / workshop

| Repo | Stack | ★ | Lisensi | Yang relevan | Keputusan |
| --- | --- | ---: | --- | --- | --- |
| [Torqvoice/torqvoice](https://github.com/Torqvoice/torqvoice) | TypeScript, self-hosted, Docker | 48 | Other / NOASSERTION | Work order, quotation, invoice, inventory, customer portal. Paling dekat dengan domain dan paling matang. | **Referensi fitur & information architecture.** Tidak dipakai sebagai basis: lisensi tidak jelas untuk derivative work, scope jauh lebih besar (portal, quotation, Docker). |
| [blackxenonn/My-Bengkel-App](https://github.com/blackxenonn/My-Bengkel-App) | Laravel, Blade, MySQL | 1 | Tidak terdeteksi | POS, inventori, karyawan, laporan penjualan; README Indonesia. | Referensi kebutuhan lokal (stok, laporan). Stack PHP/MySQL tidak dipilih karena target deploy ringan & mobile PWA. |
| [JayadyGultom/Bengkel-App](https://github.com/JayadyGultom/Bengkel-App) | Go + React | 0 | Tidak terdeteksi | Aplikasi manajemen bengkel & POS; tanpa README. | Terlalu awal/ tidak terdokumentasi; tidak dijadikan acuan. |
| [fahmiwulidan/bengkel-tracker-app](https://github.com/fahmiwulidan/bengkel-tracker-app) | Flutter/Dart, GIS, payment gateway | 1 | Tidak terdeteksi | Aplikasi mobile bengkel dengan tracking & pembayaran. | Referensi bahwa mobile-first penting; Flutter tidak dipilih karena kita butuh web/PWA satu basis kode. |
| [GrimsAlphaDev/flutter_pembukuan_transaksi_benkel](https://github.com/GrimsAlphaDev/flutter_pembukuan_transaksi_benkel) | Flutter | 0 | Tidak terdeteksi | Konsep pembukuan transaksi bengkel. | Referensi konsep saja. |

**Peluang yang belum tergarap dengan baik di repo tersebut:** fokus khusus pada *piutang pelanggan + aging + reminder WhatsApp* dan *hutang supplier* dalam satu alur mobile yang ringan, dengan laporan laba/kas yang dapat dipahami pemilik non-akuntan.

## Boilerplate & proyek POS pembanding

| Repo | Stack | ★ | Lisensi | Nilai | Alasan tidak dipakai penuh |
| --- | --- | ---: | --- | --- | --- |
| [ixartz/Next-js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate) | Next.js 16, Tailwind 4, Drizzle, Clerk, Vitest, Playwright | 13.089 | MIT | Referensi struktur App Router, disiplin typecheck/test, setup Playwright & Vitest. | Terlalu banyak layanan opsional (Sentry, Storybook, i18n, Clerk), DB Postgres; menambah kompleksitas dan biaya untuk bengkel kecil. |
| [vercel/nextjs-postgres-auth-starter](https://github.com/vercel/nextjs-postgres-auth-starter) | Next.js, Drizzle, NextAuth, Postgres | 1.054 | Tidak terdeteksi | Pola kredensial auth dan session. | Butuh database eksternal & NextAuth; auth lokal cookie JWT lebih sederhana untuk single-outlet. |
| [horizon-ui/shadcn-nextjs-boilerplate](https://github.com/horizon-ui/shadcn-nextjs-boilerplate) | Next.js, shadcn, dashboard admin | 651 | MIT | Inspirasi kepadatan dashboard dan pola kartu admin. | Tampilan admin generik; WMC 225 butuh hierarki mobile-first dan identitas visual bengkel. |
| [zxmodren/Point-of-sales-Nextjs](https://github.com/zxmodren/Point-of-sales-Nextjs) | Next.js POS | 32 | Tidak terdeteksi | Referensi alur POS/keranjang. | Proyek kecil, tanpa lisensi jelas, tidak mencakup piutang/hutang bengkel. |

## Evaluasi terhadap kebutuhan produk

| Kebutuhan | Torqvoice | My-Bengkel | Next.js Boilerplate | WMC 225 |
| --- | --- | --- | --- | --- |
| Nota servis + item jasa/sparepart | ✅ | ✅ | — | ✅ |
| Pembayaran bertahap & piutang | ✅ | sebagian | — | ✅ |
| Aging & jatuh tempo | ✅ | tidak jelas | — | ✅ |
| Hutang supplier | tidak jelas | — | — | ✅ |
| Laporan laba/HPP/arus kas | ✅ | sebagian | — | ✅ |
| Mobile-first PWA | tidak utama | tidak | tidak | ✅ |
| Database terkelola & Vercel-ready | Docker DB | MySQL | Postgres | ✅ PostgreSQL + Prisma |
| Lisensi jelas untuk dipakai ulang | ⚠️ | ❌ | ✅ | kode milik proyek ini |
| Stack modern & ringan untuk 1 outlet | ⚠️ besar | ⚠️ PHP | ⚠️ berat | ✅ |

## Keputusan arsitektur

| Keputusan | Alternatif | Alasan |
| --- | --- | --- |
| **Next.js 16 App Router + Server Actions** | Vite+Express, Laravel, Flutter | Satu codebase untuk UI & API, streaming server component, form/action type-safe, deploy sederhana. |
| **Prisma ORM + PostgreSQL** | SQLite, Drizzle, raw SQL | Target deploy Vercel membutuhkan database terkelola; Prisma memberi type-safe query, migrasi berversi, relasi eksplisit, dan alur seed yang jelas. |
| **Auth lokal JWT HttpOnly + bcrypt** | NextAuth, Clerk, Supabase Auth | Hanya butuh email/password; tidak ada vendor lock-in; data tetap di database milik pemilik bengkel. |
| **Perhitungan uang manual (integer rupiah)** | Decimal library, float | Rupiah tanpa sen; integer menghindari error pembulatan. Semua nilai dari server, bukan client. |
| **Tanggal bisnis eksplisit (`business_date`) + zona Asia/Jakarta** | timestamp tanpa tanggal bisnis | Laporan harian konsisten WIB, tidak bergantung timezone server/UTC. |
| **PWA + service worker shell** | Aplikasi native | Instalasi dari browser tanpa app store, cocok untuk ponsel bengkel; offline fallback sederhana. |
| **Seed deterministik relatif hari ini** | Fixture statis | Demo langsung terasa “hidup” kapan pun dijalankan tanpa data usang. |
| **Tidak memakai repo tanpa lisensi** | Fork/klaim kode | Menghormati hak cipta; pola domain tetap dipelajari dan diimplementasikan ulang. |

## Metode riset & keterbatasan

- Query contoh: `workshop management`, `bengkel management app`, `nextjs pos`, `nextjs boilerplate`, `point of sale nextjs`, topic POS.
- Metadata lisensi dibaca via GitHub API. “Tidak terdeteksi” berarti repo tidak menampilkan file lisensi yang dikenali GitHub, bukan jaminan bebas dipakai.
- Bintang/aktivitas bukan ukuran kualitas; beberapa repo domain yang paling relevan justru berukuran kecil/akademik.
- Repo berbahasa Indonesia cenderung menggunakan Laravel/Flutter/CodeIgniter, memberi sinyal bahwa PWA React + PostgreSQL masih jarang.
- Riset tidak melakukan benchmark performa langsung terhadap semua repo; fokus pada kecocokan domain, lisensi, dan biaya operasional.

## Referensi yang memengaruhi UX

- Pola **aging report** dan status pembayaran dari aplikasi invoice/accounting modern.
- Pola **bottom sheet, sticky summary, tab filter** dari mobile commerce/POS.
- Prinsip *single source of truth*: pembayaran adalah catatan kas; status piutang tidak diketik manual, melainkan diturunkan dari total nota vs pembayaran.
