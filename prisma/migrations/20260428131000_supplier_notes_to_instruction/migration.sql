-- Unify supplier instruction across all order-channel payloads.
-- Legacy `order.suppliers.notes` is migrated into `order_channel_payload.instruction`.

UPDATE "order"."suppliers"
SET "order_channel_payload" =
  COALESCE("order_channel_payload", '{}'::jsonb) ||
  jsonb_build_object(
    'instruction',
    CASE
      WHEN NULLIF(BTRIM(COALESCE("notes", '')), '') IS NOT NULL
        THEN BTRIM("notes")
      ELSE COALESCE(
        NULLIF(BTRIM(COALESCE("order_channel_payload"->>'instruction', '')), ''),
        ''
      )
    END
  );

-- Keep a single source of truth (`order_channel_payload.instruction`).
UPDATE "order"."suppliers"
SET "notes" = NULL
WHERE "notes" IS NOT NULL;
