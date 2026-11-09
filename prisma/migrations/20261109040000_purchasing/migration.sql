CREATE TABLE "purchases" (
  "id" SERIAL NOT NULL,
  "request_id" UUID NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "reference_no" TEXT,
  "business_date" DATE NOT NULL,
  "total" INTEGER NOT NULL,
  "notes" TEXT,
  "payable_id" INTEGER NOT NULL,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchases_total_check" CHECK ("total" > 0),
  CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchases_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "purchases_request_id_key" ON "purchases"("request_id");
CREATE UNIQUE INDEX "purchases_payable_id_key" ON "purchases"("payable_id");
CREATE UNIQUE INDEX "purchases_supplier_id_reference_no_key" ON "purchases"("supplier_id", "reference_no");
CREATE INDEX "purchases_business_date_idx" ON "purchases"("business_date");
ALTER TABLE "stock_batches" ADD COLUMN "purchase_id" INTEGER;
CREATE INDEX "stock_batches_purchase_id_idx" ON "stock_batches"("purchase_id");
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
