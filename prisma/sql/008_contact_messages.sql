-- Leadflow contact form: public submissions from the marketing site's
-- /contact page. Run this in Supabase → SQL Editor (or via psql) after
-- 001_init.sql..007_chat_session_user.sql, with DATABASE_URL set in .env
-- Then: npx prisma generate

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
