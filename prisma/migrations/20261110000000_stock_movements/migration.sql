CREATE TYPE "StockMovementType" AS ENUM ('saldo_awal', 'penerimaan', 'pembelian', 'penjualan', 'pembatalan');

CREATE TABLE "stock_movements" (
  "id" SERIAL NOT NULL,
  "item_id" INTEGER NOT NULL,
  "stock_batch_id" INTEGER,
  "type" "StockMovementType" NOT NULL,
  "qty" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "transaction_id" TEXT,
  "purchase_id" INTEGER,
  "notes" TEXT,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_movements_amounts_check" CHECK ("qty" <> 0 AND "balance_after" >= 0),
  CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "stock_movements_item_id_id_idx" ON "stock_movements"("item_id", "id");
CREATE INDEX "stock_movements_stock_batch_id_idx" ON "stock_movements"("stock_batch_id");
CREATE INDEX "stock_movements_transaction_id_idx" ON "stock_movements"("transaction_id");
CREATE INDEX "stock_movements_purchase_id_idx" ON "stock_movements"("purchase_id");
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");

-- History before this migration cannot be ordered reliably, so the ledger opens with
-- the current balance. Afterwards SUM(qty) per item always equals items.stock.
INSERT INTO "stock_movements" ("item_id", "type", "qty", "balance_after", "notes")
SELECT "id", 'saldo_awal', "stock", "stock", 'Saldo saat ledger stok diaktifkan'
FROM "items" WHERE "category" = 'sparepart' AND "stock" > 0
ORDER BY "id";
