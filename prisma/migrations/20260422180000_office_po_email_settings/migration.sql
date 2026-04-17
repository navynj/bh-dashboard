-- Office → Contact Settings: outbound PO supplier email (sender, CC, templates)
CREATE TABLE IF NOT EXISTS "order"."office_po_email_settings" (
  "id" TEXT NOT NULL,
  "sender_email" TEXT NOT NULL,
  "sender_name" TEXT NOT NULL,
  "cc_email" TEXT,
  "reply_contact_email" TEXT NOT NULL,
  "subject_template" TEXT NOT NULL,
  "body_intro_template" TEXT NOT NULL,
  "body_signature_template" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "office_po_email_settings_pkey" PRIMARY KEY ("id")
);
