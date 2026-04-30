-- Allow delivery presets without a linked `public.locations` row.
ALTER TABLE "public"."delivery_location_presets"
  DROP CONSTRAINT IF EXISTS "delivery_location_presets_location_id_fkey";

ALTER TABLE "public"."delivery_location_presets"
  ALTER COLUMN "location_id" DROP NOT NULL;

ALTER TABLE "public"."delivery_location_presets"
  ADD CONSTRAINT "delivery_location_presets_location_id_fkey"
    FOREIGN KEY ("location_id")
    REFERENCES "public"."locations"("id")
    ON DELETE SET NULL;
