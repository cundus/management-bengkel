-- Koreksi pembayaran dengan entri pembalik (reversal), bukan edit/hapus.
-- Entri pembalik bernominal negatif dan menunjuk pembayaran yang dibalik.

ALTER TABLE "payments" ADD COLUMN "reverses_payment_id" INTEGER;
CREATE UNIQUE INDEX "payments_reverses_payment_id_key" ON "payments"("reverses_payment_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_reverses_payment_id_fkey"
  FOREIGN KEY ("reverses_payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK (
  ("reverses_payment_id" IS NULL AND "amount" > 0) OR ("reverses_payment_id" IS NOT NULL AND "amount" < 0)
);

ALTER TABLE "payable_payments" ADD COLUMN "reverses_payment_id" INTEGER;
CREATE UNIQUE INDEX "payable_payments_reverses_payment_id_key" ON "payable_payments"("reverses_payment_id");
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_reverses_payment_id_fkey"
  FOREIGN KEY ("reverses_payment_id") REFERENCES "payable_payments"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_amount_check" CHECK (
  ("reverses_payment_id" IS NULL AND "amount" > 0) OR ("reverses_payment_id" IS NOT NULL AND "amount" < 0)
);

-- Entri pembalik harus: satu nota/tagihan dengan aslinya, nominal = −asli, dan bukan membalik entri pembalik.
CREATE FUNCTION "check_payment_reversal"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original RECORD;
BEGIN
  IF NEW."reverses_payment_id" IS NULL THEN RETURN NEW; END IF;
  SELECT "transaction_id", "amount", "reverses_payment_id" INTO original
    FROM "payments" WHERE "id" = NEW."reverses_payment_id";
  IF NOT FOUND THEN RAISE EXCEPTION 'Pembayaran yang dibalik tidak ditemukan'; END IF;
  IF original."reverses_payment_id" IS NOT NULL THEN RAISE EXCEPTION 'Entri pembalik tidak bisa dibalik lagi'; END IF;
  IF original."transaction_id" <> NEW."transaction_id" THEN RAISE EXCEPTION 'Entri pembalik harus pada nota yang sama'; END IF;
  IF NEW."amount" <> -original."amount" THEN RAISE EXCEPTION 'Nominal entri pembalik harus sama dengan pembayaran asli'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "payments_reversal_check"
  BEFORE INSERT OR UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION "check_payment_reversal"();

CREATE FUNCTION "check_payable_payment_reversal"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original RECORD;
BEGIN
  IF NEW."reverses_payment_id" IS NULL THEN RETURN NEW; END IF;
  SELECT "payable_id", "amount", "reverses_payment_id" INTO original
    FROM "payable_payments" WHERE "id" = NEW."reverses_payment_id";
  IF NOT FOUND THEN RAISE EXCEPTION 'Pembayaran hutang yang dibalik tidak ditemukan'; END IF;
  IF original."reverses_payment_id" IS NOT NULL THEN RAISE EXCEPTION 'Entri pembalik tidak bisa dibalik lagi'; END IF;
  IF original."payable_id" <> NEW."payable_id" THEN RAISE EXCEPTION 'Entri pembalik harus pada tagihan yang sama'; END IF;
  IF NEW."amount" <> -original."amount" THEN RAISE EXCEPTION 'Nominal entri pembalik harus sama dengan pembayaran asli'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "payable_payments_reversal_check"
  BEFORE INSERT OR UPDATE ON "payable_payments"
  FOR EACH ROW EXECUTE FUNCTION "check_payable_payment_reversal"();
