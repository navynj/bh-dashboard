-- From / reply contact are no longer stored; use SMTP env + intro template text instead.
ALTER TABLE "order"."office_po_email_settings" DROP COLUMN IF EXISTS "sender_email";
ALTER TABLE "order"."office_po_email_settings" DROP COLUMN IF EXISTS "reply_contact_email";
