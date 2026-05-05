-- Remove erroneous direct cost_id FK from tags table.
-- Tags are standalone; cost↔tag associations live in cost_tags junction only.
ALTER TABLE "cost"."tags" DROP COLUMN IF EXISTS "cost_id";
