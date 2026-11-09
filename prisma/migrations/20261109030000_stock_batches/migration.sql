CREATE TABLE "stock_batches" (
  "id" SERIAL NOT NULL,
  "item_id" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "received_date" DATE NOT NULL,
  "quantity" INTEGER NOT NULL,
  "remaining" INTEGER NOT NULL,
  "unit_cost" INTEGER NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_batches_quantities_check" CHECK ("quantity" > 0 AND "remaining" >= 0 AND "remaining" <= "quantity" AND "unit_cost" >= 0),
  CONSTRAINT "stock_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_batches_item_id_code_key" ON "stock_batches"("item_id", "code");
CREATE INDEX "stock_batches_item_id_received_date_id_idx" ON "stock_batches"("item_id", "received_date", "id");
ALTER TABLE "transaction_items" ADD COLUMN "stock_batch_id" INTEGER;
CREATE INDEX "transaction_items_stock_batch_id_idx" ON "transaction_items"("stock_batch_id");
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve current balances and historical transaction costs unchanged.
INSERT INTO "stock_batches" ("item_id", "code", "received_date", "quantity", "remaining", "unit_cost", "notes")
SELECT "id", 'STOK-AWAL', ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date,
       "stock", "stock", "cost", 'Saldo stok sebelum pencatatan batch'
FROM "items" WHERE "category" = 'sparepart' AND "stock" > 0;
