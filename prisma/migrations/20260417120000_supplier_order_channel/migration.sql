-- Supplier order channel: type + JSON payload (order schema)
ALTER TABLE "order"."suppliers"
  ADD COLUMN IF NOT EXISTS "order_channel_type" TEXT,
  ADD COLUMN IF NOT EXISTS "order_channel_payload" JSONB;

-- 1) Backfill type from legacy columns when missing or blank
UPDATE "order"."suppliers"
SET "order_channel_type" = CASE
  WHEN NULLIF(TRIM(COALESCE("contact_email", '')), '') IS NOT NULL THEN 'email'
  WHEN NULLIF(TRIM(COALESCE("link", '')), '') IS NOT NULL THEN 'order_link'
  ELSE 'direct_instruction'
END
WHERE "order_channel_type" IS NULL OR TRIM(COALESCE("order_channel_type", '')) = '';

-- 1b) Guarantee no NULL type remains before NOT NULL (covers db push / partial applies)
UPDATE "order"."suppliers"
SET "order_channel_type" = 'email'
WHERE "order_channel_type" IS NULL;

-- 2) Backfill payload when null (uses current order_channel_type + legacy columns)
UPDATE "order"."suppliers"
SET "order_channel_payload" = CASE "order_channel_type"
  WHEN 'email' THEN jsonb_build_object(
    'contactEmail', NULLIF(TRIM(COALESCE("contact_email", '')), ''),
    'contactName', NULLIF(TRIM(COALESCE("contact_name", '')), '')
  )
  WHEN 'order_link' THEN jsonb_build_object(
    'orderUrl', NULLIF(TRIM(COALESCE("link", '')), ''),
    'instruction', COALESCE(NULLIF(TRIM(COALESCE("notes", '')), ''), ''),
    'invoiceConfirmSenderEmail', NULL
  )
  ELSE jsonb_build_object(
    'instruction', COALESCE(NULLIF(TRIM(COALESCE("notes", '')), ''), '')
  )
END
WHERE "order_channel_payload" IS NULL;

ALTER TABLE "order"."suppliers"
  ALTER COLUMN "order_channel_type" SET DEFAULT 'email',
  ALTER COLUMN "order_channel_type" SET NOT NULL;
