-- Allow office users to waive "send PO email" reminders without sending.
ALTER TABLE "order"."purchase_orders"
ADD COLUMN IF NOT EXISTS "email_delivery_waived_at" TIMESTAMPTZ;
