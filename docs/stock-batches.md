# Batch stok

Stok masuk dicatat melalui **Stok & jasa → Batch stok**. Setiap lot mempunyai kode unik per item, tanggal masuk, jumlah awal, sisa, dan modal per unit. Modal acuan di katalog hanya mengisi nilai awal form penerimaan; mengubahnya tidak mengubah modal batch.

Penjualan memakai FIFO (tanggal masuk, lalu ID batch). Penjualan yang melintasi batch mempunyai beberapa baris nota dengan modal masing-masing agar HPP tetap tepat tanpa pembulatan. Pembatalan mengembalikan sisa ke batch asal. Nota lama tanpa batch membuat batch pengembalian dengan modal historis nota.

## Migrasi dan rilis

- Migrasi `20261109030000_stock_batches` menambah tabel dan relasi nullable; saldo sparepart positif disalin menjadi `STOK-AWAL`. Saldo item dan nota historis tidak diubah.
- Terapkan migrasi sebelum kode baru menerima trafik. Hentikan sementara penulisan stok/transaksi oleh versi lama selama perpindahan; versi lama belum memelihara saldo batch. Deploy melalui Git integration sesuai AGENTS.md.
- Verifikasi jumlah `items.stock` sama dengan total `stock_batches.remaining` untuk setiap sparepart, serta coba penerimaan, penjualan lintas batch, dan pembatalan di lingkungan uji.
- Rollback aplikasi: hentikan penulisan stok/transaksi, kembalikan kode lama, pertahankan tabel/kolom baru agar riwayat tidak hilang. Sebelum mengaktifkan versi batch kembali, rekonsiliasi perubahan stok selama versi lama aktif. Tidak ada migrasi penghapusan data otomatis.
