-- Optional JSON: delivery weekdays + rule for default PO expected date (order schema)
ALTER TABLE "order"."suppliers"
  ADD COLUMN IF NOT EXISTS "delivery_schedule" JSONB;
