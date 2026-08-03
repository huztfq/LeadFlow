-- Leadflow profile + settings: editable name/username fields and a small
-- JSON preferences bag on User. Run this in Supabase → SQL Editor (or via
-- psql) after 001-005, with DATABASE_URL set in .env.
-- Then: npx prisma generate

-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "prefs" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
