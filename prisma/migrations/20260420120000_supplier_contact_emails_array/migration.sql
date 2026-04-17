-- Multiple supplier contact emails (denormalized list on order.suppliers)
ALTER TABLE "order"."suppliers"
  ADD COLUMN IF NOT EXISTS "contact_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Prefer legacy single column; otherwise derive from email channel JSON
UPDATE "order"."suppliers"
SET "contact_emails" = CASE
  WHEN NULLIF(TRIM(COALESCE("contact_email", '')), '') IS NOT NULL THEN
    ARRAY[NULLIF(TRIM("contact_email"), '')]::TEXT[]
  WHEN "order_channel_type" = 'email'
    AND NULLIF(TRIM(COALESCE("order_channel_payload"->>'contactEmail', '')), '') IS NOT NULL THEN
    ARRAY[NULLIF(TRIM("order_channel_payload"->>'contactEmail'), '')]::TEXT[]
  ELSE ARRAY[]::TEXT[]
END;

ALTER TABLE "order"."suppliers" DROP COLUMN IF EXISTS "contact_email";
