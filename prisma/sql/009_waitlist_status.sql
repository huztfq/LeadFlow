-- Leadflow waitlist status: lets an owner Allow (invite) or Block a waitlist
-- signup from Oversight instead of only viewing it. Run this in Supabase →
-- SQL Editor (or via psql) after 001_init.sql..008_contact_messages.sql,
-- with DATABASE_URL set in .env
-- Then: npx prisma generate

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('pending', 'allowed', 'blocked');

-- AlterTable
ALTER TABLE "WaitlistSignup" ADD COLUMN "status" "WaitlistStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "WaitlistSignup_status_idx" ON "WaitlistSignup"("status");
