-- Leadflow Studio chat session history
-- Run this in Supabase → SQL Editor (or via psql) after 001_init.sql, with DATABASE_URL set in .env
-- Then: npx prisma generate

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "plan" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSession_pinned_updatedAt_idx" ON "ChatSession"("pinned", "updatedAt");
