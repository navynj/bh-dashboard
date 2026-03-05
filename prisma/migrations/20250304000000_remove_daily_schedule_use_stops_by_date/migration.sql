-- Remove DailySchedule table: store date + driverId on each stop and query stops by date filter.
-- Step 1: Add new columns (nullable)
ALTER TABLE "delivery"."daily_schedule_stops" ADD COLUMN IF NOT EXISTS "date" DATE;
ALTER TABLE "delivery"."daily_schedule_stops" ADD COLUMN IF NOT EXISTS "driver_id" TEXT;

-- Step 2: Backfill from daily_schedules
UPDATE "delivery"."daily_schedule_stops" s
SET "date" = sch."date", "driver_id" = sch."driver_id"
FROM "delivery"."daily_schedules" sch
WHERE sch."id" = s."daily_schedule_id";

-- Step 3: Drop old FK column and set new columns NOT NULL
ALTER TABLE "delivery"."daily_schedule_stops" DROP COLUMN IF EXISTS "daily_schedule_id";
ALTER TABLE "delivery"."daily_schedule_stops" ALTER COLUMN "date" SET NOT NULL;
ALTER TABLE "delivery"."daily_schedule_stops" ALTER COLUMN "driver_id" SET NOT NULL;

-- Step 4: Add FK to drivers
ALTER TABLE "delivery"."daily_schedule_stops" ADD CONSTRAINT "daily_schedule_stops_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "delivery"."drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Drop daily_schedules table
DROP TABLE IF EXISTS "delivery"."daily_schedules";

-- Step 6: Index for date + driverId queries
CREATE INDEX IF NOT EXISTS "daily_schedule_stops_date_driver_id_idx" ON "delivery"."daily_schedule_stops"("date", "driver_id");
