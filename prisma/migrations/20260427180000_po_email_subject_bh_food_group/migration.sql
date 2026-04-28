-- Align default PO email subject with app default (custom subjects unchanged).
UPDATE "order"."office_po_email_settings"
SET "subject_template" = 'Purchase Order {{poNumber}} from BH Food Group'
WHERE "subject_template" = 'Purchase Order {{poNumber}}';
