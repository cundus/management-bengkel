# Migrasi login username

Kolom `users.username` bersifat nullable dan unik. Migrasi tidak mengubah email, kata sandi, role, atau data akun lama. Username baru disimpan sebagai huruf kecil; constraint database memvalidasi format tersebut.

Urutan rilis:

1. Jalankan `pnpm db:deploy` pada database tujuan sebelum merilis kode baru.
2. Deploy aplikasi. Akun lama tetap login menggunakan email; pemilik dapat mengisi username melalui Manajemen Akun. Username tidak dibuat otomatis untuk akun lama.
3. Verifikasi login email lama, login username tanpa membedakan huruf besar/kecil, dan penolakan username duplikat.

Untuk akun pemilik pertama, `pnpm db:create-admin` menerima `ADMIN_USERNAME` opsional selain variabel yang sudah ada.

Rollback aplikasi: kembalikan deployment sebelumnya dan biarkan kolom username beserta indeks/constraint tetap tersedia. Kode sebelumnya tetap bekerja dengan kolom tambahan ini. Jangan menghapus kolom saat rollback karena username yang sudah diatur akan hilang. Migrasi production belum dijalankan sebagai bagian dari implementasi lokal.
