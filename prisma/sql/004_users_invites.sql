-- Leadflow multi-user auth: User accounts + team invites with per-user Apollo
-- / AI credit limits. Run this in Supabase → SQL Editor (or via psql) after
-- 001_init.sql, 002_chat_sessions.sql, and 003_inbox_calendar.sql, with
-- DATABASE_URL set in .env
-- Then: npx prisma generate

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'member');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "passwordHash" TEXT,
    "apolloCreditLimit" INTEGER,
    "apolloCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "aiCreditLimit" INTEGER,
    "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "apolloCreditLimit" INTEGER,
    "aiCreditLimit" INTEGER,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
