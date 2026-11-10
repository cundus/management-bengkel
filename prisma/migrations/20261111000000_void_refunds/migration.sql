CREATE TYPE "VoidRequestStatus" AS ENUM ('pending', 'disetujui', 'ditolak');

ALTER TABLE "transactions"
  ADD COLUMN "voided_by" INTEGER,
  ADD COLUMN "voided_date" DATE;

-- Nota yang sudah dibatalkan sebelumnya: tanggal bisnis pembatalan dari voided_at (WIB).
UPDATE "transactions"
SET "voided_date" = ("voided_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date
WHERE "status" = 'batal' AND "voided_at" IS NOT NULL;

CREATE INDEX "transactions_voided_date_idx" ON "transactions"("voided_date");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_voided_by_fkey"
  FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "refunds" (
  "id" SERIAL NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "notes" TEXT,
  "business_date" DATE NOT NULL,
  "refunded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" INTEGER NOT NULL,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refunds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "refunds_transaction_id_idx" ON "refunds"("transaction_id");
CREATE INDEX "refunds_business_date_idx" ON "refunds"("business_date");

CREATE TABLE "void_requests" (
  "id" SERIAL NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "VoidRequestStatus" NOT NULL DEFAULT 'pending',
  "requested_by" INTEGER NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  CONSTRAINT "void_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "void_requests_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "void_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "void_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "void_requests_transaction_id_idx" ON "void_requests"("transaction_id");
CREATE INDEX "void_requests_status_idx" ON "void_requests"("status");
