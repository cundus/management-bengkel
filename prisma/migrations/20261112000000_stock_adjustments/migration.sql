ALTER TYPE "StockMovementType" ADD VALUE 'penyesuaian';

CREATE TYPE "StockAdjustmentReason" AS ENUM ('rusak', 'hilang', 'kedaluwarsa', 'pemakaian_internal', 'ditemukan', 'salah_catat', 'lainnya');

CREATE TABLE "stock_adjustments" (
  "id" SERIAL NOT NULL,
  "item_id" INTEGER NOT NULL,
  "reason" "StockAdjustmentReason" NOT NULL,
  "qty" INTEGER NOT NULL,
  "stock_before" INTEGER NOT NULL,
  "stock_after" INTEGER NOT NULL,
  "value" INTEGER NOT NULL,
  "notes" TEXT NOT NULL,
  "business_date" DATE NOT NULL,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_adjustments_amounts_check" CHECK (
    "qty" <> 0 AND "stock_before" >= 0 AND "stock_after" >= 0
    AND "stock_after" = "stock_before" + "qty"
    AND ("value" = 0 OR sign("value") = sign("qty"))
    AND length(btrim("notes")) > 0
  ),
  CONSTRAINT "stock_adjustments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "stock_adjustments_item_id_id_idx" ON "stock_adjustments"("item_id", "id");
CREATE INDEX "stock_adjustments_business_date_idx" ON "stock_adjustments"("business_date");

ALTER TABLE "stock_movements" ADD COLUMN "stock_adjustment_id" INTEGER;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_adjustment_id_fkey"
  FOREIGN KEY ("stock_adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "stock_movements_stock_adjustment_id_idx" ON "stock_movements"("stock_adjustment_id");
