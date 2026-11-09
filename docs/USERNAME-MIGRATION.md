# Migrasi login username

Kolom `users.username` bersifat nullable dan unik. Migrasi tidak mengubah email, kata sandi, role, atau data akun lama. Username baru disimpan sebagai huruf kecil; constraint database memvalidasi format tersebut.

Urutan rilis:

1. Push kode ke repository. Build Vercel menjalankan `pnpm db:deploy` sebelum `pnpm build`, sehingga database tujuan siap sebelum versi baru dirilis. Untuk perbaikan deployment yang sudah aktif, migrasi dapat dijalankan terpisah dengan `pnpm db:deploy` memakai konfigurasi database production.
2. Integrasi Git Vercel merilis aplikasi setelah migrasi dan build berhasil. Akun lama tetap login menggunakan email; pemilik dapat mengisi username melalui Manajemen Akun. Username tidak dibuat otomatis untuk akun lama.
3. Verifikasi login email lama, login username tanpa membedakan huruf besar/kecil, dan penolakan username duplikat.

Untuk akun pemilik pertama, `pnpm db:create-admin` menerima `ADMIN_USERNAME` opsional selain variabel yang sudah ada.

Rollback aplikasi: kembalikan deployment sebelumnya dan biarkan kolom username beserta indeks/constraint tetap tersedia. Kode sebelumnya tetap bekerja dengan kolom tambahan ini. Jangan menghapus kolom saat rollback karena username yang sudah diatur akan hilang.
