-- Run against your DB when `prisma db push` fails with:
-- "Made the column order_channel_type required, but there are N existing NULL values"
-- This does NOT drop data. Safe to run multiple times.
--
-- Usage (pick one):
--   psql "$DATABASE_URL" -f scripts/fix-supplier-order-channel-nulls.sql
--   npx prisma db execute --file scripts/fix-supplier-order-channel-nulls.sql

-- 1) Fill NULL / blank type from legacy columns
UPDATE "order"."suppliers"
SET "order_channel_type" = CASE
  WHEN NULLIF(TRIM(COALESCE("contact_email", '')), '') IS NOT NULL THEN 'email'
  WHEN NULLIF(TRIM(COALESCE("link", '')), '') IS NOT NULL THEN 'order_link'
  ELSE 'direct_instruction'
END
WHERE "order_channel_type" IS NULL
   OR TRIM(COALESCE("order_channel_type", '')) = '';

-- 2) Any still-null (edge case) → email
UPDATE "order"."suppliers"
SET "order_channel_type" = 'email'
WHERE "order_channel_type" IS NULL;

-- 3) Payload when missing
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

-- 4) Now NOT NULL + default is safe
ALTER TABLE "order"."suppliers"
  ALTER COLUMN "order_channel_type" SET DEFAULT 'email';

ALTER TABLE "order"."suppliers"
  ALTER COLUMN "order_channel_type" SET NOT NULL;
