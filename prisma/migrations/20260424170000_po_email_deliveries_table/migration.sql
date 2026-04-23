-- Create po_email_deliveries table.
-- Tracks individual email sends per PO (one row per recipient delivery).

CREATE TABLE IF NOT EXISTS "order"."po_email_deliveries" (
  "id"               TEXT        NOT NULL,
  "purchase_order_id" TEXT       NOT NULL,
  "recipient_email"  TEXT        NOT NULL,
  "recipient_name"   TEXT,
  "tracking_token"   TEXT        NOT NULL,
  "sent_at"          TIMESTAMPTZ NOT NULL,
  "opened_at"        TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "po_email_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "po_email_deliveries_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id")
    REFERENCES "order"."purchase_orders"("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "po_email_deliveries_tracking_token_key"
  ON "order"."po_email_deliveries" ("tracking_token");

CREATE INDEX IF NOT EXISTS "po_email_deliveries_purchase_order_id_idx"
  ON "order"."po_email_deliveries" ("purchase_order_id");
