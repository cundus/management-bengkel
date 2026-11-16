-- Koreksi pengeluaran dengan entri pembalik (reversal), bukan edit/hapus.
-- Entri pembalik bernominal negatif dan menunjuk pengeluaran yang dibalik.

ALTER TABLE "expenses" ADD COLUMN "reverses_expense_id" INTEGER;
CREATE UNIQUE INDEX "expenses_reverses_expense_id_key" ON "expenses"("reverses_expense_id");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reverses_expense_id_fkey"
  FOREIGN KEY ("reverses_expense_id") REFERENCES "expenses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_check" CHECK (
  ("reverses_expense_id" IS NULL AND "amount" > 0) OR ("reverses_expense_id" IS NOT NULL AND "amount" < 0)
);

-- Entri pembalik harus: kategori sama, nominal = −asli, dan bukan membalik entri pembalik.
CREATE FUNCTION "check_expense_reversal"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original RECORD;
BEGIN
  IF NEW."reverses_expense_id" IS NULL THEN RETURN NEW; END IF;
  SELECT "category", "amount", "reverses_expense_id" INTO original
    FROM "expenses" WHERE "id" = NEW."reverses_expense_id";
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengeluaran yang dibalik tidak ditemukan'; END IF;
  IF original."reverses_expense_id" IS NOT NULL THEN RAISE EXCEPTION 'Entri pembalik tidak bisa dibalik lagi'; END IF;
  IF original."category" <> NEW."category" THEN RAISE EXCEPTION 'Entri pembalik harus pada kategori yang sama'; END IF;
  IF NEW."amount" <> -original."amount" THEN RAISE EXCEPTION 'Nominal entri pembalik harus sama dengan pengeluaran asli'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "expenses_reversal_check"
  BEFORE INSERT OR UPDATE ON "expenses"
  FOR EACH ROW EXECUTE FUNCTION "check_expense_reversal"();