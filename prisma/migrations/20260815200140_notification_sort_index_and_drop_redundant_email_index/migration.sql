-- DropIndex
DROP INDEX "User_email_idx";

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
