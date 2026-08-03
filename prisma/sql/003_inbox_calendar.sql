-- Leadflow Inbox + Stats + Calendar schema additions
-- Run this in Supabase → SQL Editor (or via psql) after 001_init.sql and
-- 002_chat_sessions.sql, with DATABASE_URL set in .env
-- Then: npx prisma generate

-- CreateEnum
CREATE TYPE "InboxCategory" AS ENUM ('interested', 'not_interested', 'booked', 'question', 'ooo', 'unsubscribe', 'other');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('google', 'ical', 'link');

-- AlterTable: SendLog gains open/click/reply/bounce tracking, populated by the
-- Resend webhook (see /api/webhooks/resend).
ALTER TABLE "SendLog"
  ADD COLUMN "openedAt" TIMESTAMP(3),
  ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clickedAt" TIMESTAMP(3),
  ADD COLUMN "repliedAt" TIMESTAMP(3),
  ADD COLUMN "bouncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SendLog_resendId_idx" ON "SendLog"("resendId");

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "enrollmentId" TEXT,
    "leadId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT,
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "resendEmailId" TEXT,
    "category" "InboxCategory" NOT NULL DEFAULT 'other',
    "categoryConfidence" DOUBLE PRECISION,
    "categorySource" TEXT NOT NULL DEFAULT 'ai',
    "rawJson" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "provider" "CalendarProvider" NOT NULL,
    "label" TEXT,
    "icalUrl" TEXT,
    "bookingUrl" TEXT,
    "googleEmail" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "leadId" TEXT,
    "inboxMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxMessage_category_idx" ON "InboxMessage"("category");

-- CreateIndex
CREATE INDEX "InboxMessage_receivedAt_idx" ON "InboxMessage"("receivedAt");

-- CreateIndex
CREATE INDEX "InboxMessage_readAt_idx" ON "InboxMessage"("readAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_inboxMessageId_key" ON "CalendarEvent"("inboxMessageId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_inboxMessageId_fkey" FOREIGN KEY ("inboxMessageId") REFERENCES "InboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
