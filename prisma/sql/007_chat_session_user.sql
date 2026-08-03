-- Scope Studio chat sessions to the account that created them, so one
-- account can never see another's chats. Nullable + SetNull-on-delete so
-- existing rows and user deletions don't break; orphaned (null-userId)
-- sessions simply stop matching any account's session list.
-- Run this in Supabase → SQL Editor (or via psql) after 001-006, with
-- DATABASE_URL set in .env. Then: npx prisma generate

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "userId" TEXT;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ChatSession_userId_pinned_updatedAt_idx" ON "ChatSession"("userId", "pinned", "updatedAt");
