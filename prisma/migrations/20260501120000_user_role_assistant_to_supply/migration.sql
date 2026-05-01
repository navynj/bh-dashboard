-- Rename hub ops role: `assistant` → `supply` (Prisma `UserRole` enum, public schema).
ALTER TYPE "public"."UserRole" RENAME VALUE 'assistant' TO 'supply';
